#!/usr/bin/env groovy

/**
 * Jenkins Pipeline for SVGER-CLI
 * Supports CI/CD for multiple branches and release management
 */

pipeline {
    agent any

    // Environment variables
    environment {
        NODE_VERSION = '18.x'
        NPM_REGISTRY = 'https://registry.npmjs.org'
        DOCKER_REGISTRY = 'ghcr.io'
        PROJECT_NAME = 'svger-cli'
        SLACK_CHANNEL = '#svger-cli-builds'
    }

    // Build parameters
    parameters {
        choice(
            name: 'BUILD_TYPE',
            choices: ['CI', 'Release', 'Docker'],
            description: 'Type of build to execute'
        )
        string(
            name: 'VERSION',
            defaultValue: '',
            description: 'Version for release (e.g., 1.2.3)'
        )
    }

    // Build options
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    // Trigger configuration
    triggers {
        // Poll SCM every 15 minutes
        pollSCM('H/15 * * * *')
        // Trigger on main and develop branches
        cron(env.BRANCH_NAME == 'main' ? '@daily' : '')
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "🔄 Checking out code from ${env.BRANCH_NAME}"
                    checkout scm
                    
                    // Get commit information
                    env.GIT_COMMIT_MSG = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()
                    env.GIT_AUTHOR = sh(
                        script: 'git log -1 --pretty=%an',
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Setup') {
            steps {
                script {
                    echo "⚙️ Setting up Node.js ${NODE_VERSION}"
                    sh """
                        # Use NVM to install and use correct Node version
                        export NVM_DIR="\$HOME/.nvm"
                        [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
                        nvm install ${NODE_VERSION}
                        nvm use ${NODE_VERSION}
                        node --version
                        npm --version
                    """
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    echo "📦 Installing dependencies..."
                    sh 'npm ci'
                }
            }
        }

        stage('Lint & Type Check') {
            parallel {
                stage('Lint') {
                    steps {
                        script {
                            echo "🔍 Running ESLint..."
                            sh 'npm run lint'
                        }
                    }
                }
                stage('Type Check') {
                    steps {
                        script {
                            echo "🔍 Running TypeScript type check..."
                            sh 'npm run typecheck'
                        }
                    }
                }
                stage('Format Check') {
                    steps {
                        script {
                            echo "🔍 Checking code formatting..."
                            sh 'npm run format:check'
                        }
                    }
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    echo "🔨 Building project..."
                    sh 'npm run build'
                }
            }
        }

        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        script {
                            echo "🧪 Running unit tests..."
                            sh 'npm run test:coverage'
                        }
                    }
                }
                stage('Integration Tests') {
                    steps {
                        script {
                            echo "🧪 Running integration tests..."
                            sh 'npm run test:integration'
                        }
                    }
                }
            }
            post {
                always {
                    // Publish test results
                    junit '**/test-results/*.xml'
                    // Publish coverage report
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }

        stage('Security Audit') {
            steps {
                script {
                    echo "🔒 Running security audit..."
                    sh '''
                        npm audit --audit-level moderate || true
                        npm audit --json > audit-results.json || true
                    '''
                }
            }
        }

        stage('Package') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                    expression { params.BUILD_TYPE == 'Release' }
                }
            }
            steps {
                script {
                    echo "📦 Creating package..."
                    sh 'npm pack'
                    archiveArtifacts artifacts: '*.tgz', fingerprint: true
                }
            }
        }

        stage('Docker Build') {
            when {
                anyOf {
                    branch 'main'
                    expression { params.BUILD_TYPE == 'Docker' }
                    expression { params.BUILD_TYPE == 'Release' }
                }
            }
            steps {
                script {
                    echo "🐳 Building Docker image..."
                    def imageName = "${DOCKER_REGISTRY}/${PROJECT_NAME}"
                    def imageTag = env.BRANCH_NAME == 'main' ? 'latest' : env.BRANCH_NAME
                    
                    sh """
                        docker build -t ${imageName}:${imageTag} .
                        docker tag ${imageName}:${imageTag} ${imageName}:build-${BUILD_NUMBER}
                    """
                    
                    env.DOCKER_IMAGE = "${imageName}:${imageTag}"
                }
            }
        }

        stage('Release') {
            when {
                allOf {
                    branch 'main'
                    expression { params.BUILD_TYPE == 'Release' }
                    expression { params.VERSION != '' }
                }
            }
            steps {
                script {
                    echo "🚀 Publishing release ${params.VERSION}..."
                    
                    withCredentials([string(credentialsId: 'npm-token', variable: 'NPM_TOKEN')]) {
                        sh """
                            echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
                            npm publish --access public
                        """
                    }
                    
                    // Tag the release
                    sh """
                        git tag -a v${params.VERSION} -m "Release version ${params.VERSION}"
                        git push origin v${params.VERSION}
                    """
                }
            }
        }

        stage('Docker Push') {
            when {
                allOf {
                    branch 'main'
                    anyOf {
                        expression { params.BUILD_TYPE == 'Docker' }
                        expression { params.BUILD_TYPE == 'Release' }
                    }
                }
            }
            steps {
                script {
                    echo "🐳 Pushing Docker image..."
                    
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-registry-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                            echo ${DOCKER_PASS} | docker login ${DOCKER_REGISTRY} -u ${DOCKER_USER} --password-stdin
                            docker push ${DOCKER_IMAGE}
                            docker push ${DOCKER_REGISTRY}/${PROJECT_NAME}:build-${BUILD_NUMBER}
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            script {
                echo "✅ Build completed successfully!"
                
                // Send success notification
                if (env.SLACK_WEBHOOK) {
                    slackSend(
                        channel: SLACK_CHANNEL,
                        color: 'good',
                        message: """
                            ✅ Build #${BUILD_NUMBER} succeeded
                            Project: ${PROJECT_NAME}
                            Branch: ${BRANCH_NAME}
                            Commit: ${GIT_COMMIT_MSG}
                            Author: ${GIT_AUTHOR}
                            Duration: ${currentBuild.durationString}
                        """.stripIndent()
                    )
                }
            }
        }
        
        failure {
            script {
                echo "❌ Build failed!"
                
                // Send failure notification
                if (env.SLACK_WEBHOOK) {
                    slackSend(
                        channel: SLACK_CHANNEL,
                        color: 'danger',
                        message: """
                            ❌ Build #${BUILD_NUMBER} failed
                            Project: ${PROJECT_NAME}
                            Branch: ${BRANCH_NAME}
                            Commit: ${GIT_COMMIT_MSG}
                            Author: ${GIT_AUTHOR}
                            Check: ${BUILD_URL}
                        """.stripIndent()
                    )
                }
            }
        }
        
        unstable {
            script {
                echo "⚠️ Build is unstable"
            }
        }
        
        always {
            // Cleanup
            script {
                echo "🧹 Cleaning up..."
                sh 'docker system prune -f || true'
            }
            
            // Clean workspace
            cleanWs(
                deleteDirs: true,
                patterns: [
                    [pattern: 'node_modules/**', type: 'INCLUDE'],
                    [pattern: 'dist/**', type: 'INCLUDE'],
                    [pattern: 'coverage/**', type: 'INCLUDE']
                ]
            )
        }
    }
}
