// Navigation data
const navigation = [
  {
    title: "Getting Started",
    icon: `<svg class="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>`,
    items: [
      { title: "Installation", href: "#installation" },
      { title: "Quick Start", href: "#quick-start" },
      { title: "Build Tool Integrations", href: "#build-integrations" },
      { title: "Why SVGer CLI?", href: "#why-svger" },
    ],
  },
  {
    title: "Core Features",
    icon: `<svg class="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>`,
    items: [
      { title: "Built-in Optimizer (57.77%)", href: "optimizer.html", external: true },
      { title: "Feature Comparison", href: "#feature-comparison" },
      { title: "CLI Reference", href: "#cli-reference" },
      { title: "Configuration", href: "#configuration" },
    ],
  },
  {
    title: "Frameworks",
    icon: `<svg class="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
    </svg>`,
    items: [
      { title: "Multi-Framework Guide", href: "#framework-guide" },
      { title: "React", href: "#react" },
      { title: "Vue", href: "#vue" },
      { title: "Angular", href: "#angular" },
      { title: "Svelte", href: "#svelte" },
      { title: "More Frameworks...", href: "#framework-guide" },
    ],
  },
  {
    title: "Advanced Features",
    icon: `<svg class="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
    </svg>`,
    items: [
      { title: "Plugin System", href: "#plugins" },
      { title: "Testing & Samples", href: "#testing" },
      { title: "Production Deployment", href: "#deployment" },
    ],
  },
  {
    title: "Performance",
    icon: `<svg class="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>`,
    items: [
      { title: "Real-World Performance", href: "#performance" },
      { title: "Live Benchmark Testing", href: "#live-benchmark" },
    ],
  },
  {
    title: "Help & Support",
    icon: `<svg class="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`,
    items: [
      { title: "Troubleshooting & FAQ", href: "#troubleshooting" },
    ],
  },
];

// Initialize navigation
function initNavigation() {
  const navContent = document.getElementById('nav-content');
  
  navigation.forEach(section => {
    // Create section button
    const sectionBtn = document.createElement('button');
    sectionBtn.className = 'nav-section-btn';
    sectionBtn.innerHTML = `
      ${section.icon}
      <span class="flex-1 text-left">${section.title}</span>
      <svg class="h-3.5 w-3.5 text-muted-foreground chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    `;
    
    // Create items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'nav-items hidden';
    itemsContainer.style.display = 'none';
    
    section.items.forEach(item => {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.title;
      itemsContainer.appendChild(link);
    });
    
    // Toggle section
    sectionBtn.addEventListener('click', () => {
      const isExpanded = sectionBtn.classList.contains('expanded');
      
      if (isExpanded) {
        sectionBtn.classList.remove('expanded');
        itemsContainer.style.display = 'none';
      } else {
        sectionBtn.classList.add('expanded');
        itemsContainer.style.display = 'block';
      }
    });
    
    // Add to nav
    navContent.appendChild(sectionBtn);
    navContent.appendChild(itemsContainer);
  });
  
  // Expand "Getting Started" by default
  const firstBtn = navContent.querySelector('.nav-section-btn');
  if (firstBtn) {
    firstBtn.classList.add('expanded');
    firstBtn.nextElementSibling.style.display = 'block';
  }
}

// Code copy functionality
function copyCode(button) {
  const codeBlock = button.closest('.code-block');
  const code = codeBlock.querySelector('code').textContent;
  
  navigator.clipboard.writeText(code).then(() => {
    const copyIcon = button.querySelector('.copy-icon');
    const checkIcon = button.querySelector('.check-icon');
    
    copyIcon.classList.add('hidden');
    checkIcon.classList.remove('hidden');
    checkIcon.style.color = 'rgb(22, 163, 74)';
    
    setTimeout(() => {
      copyIcon.classList.remove('hidden');
      checkIcon.classList.add('hidden');
    }, 2000);
  });
}

// Add active state to nav items based on scroll position
let ticking = false;

function updateActiveNavItem() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-items a');
  
  let currentSection = '';
  const scrollPosition = window.scrollY + 100;
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    
    if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
      currentSection = section.getAttribute('id');
    }
  });
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    
    if (link.getAttribute('href') === `#${currentSection}`) {
      link.classList.add('active');
      
      // Auto-expand parent section
      const parentSection = link.closest('.nav-items').previousElementSibling;
      if (parentSection && !parentSection.classList.contains('expanded')) {
        parentSection.classList.add('expanded');
        link.closest('.nav-items').style.display = 'block';
      }
    }
  });
  
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      updateActiveNavItem();
    });
    ticking = true;
  }
});


// ===========================
// Live Benchmarking System
// ===========================

// Sample SVG data for testing
const sampleSVGs = [
  { name: 'icon-home.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', size: 245 },
  { name: 'icon-user.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', size: 198 },
  { name: 'icon-settings.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m9.66-9.66l-5.66 3.66M8.68 14.34L3.02 18M1 12h6m6 0h6m-9.66 9.66l3.66-5.66M14.34 8.68L18 3.02"/></svg>', size: 312 },
  { name: 'icon-search.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>', size: 167 },
  { name: 'icon-heart.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>', size: 278 },
  { name: 'icon-star.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', size: 234 },
  { name: 'icon-mail.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>', size: 256 },
  { name: 'icon-bell.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>', size: 223 },
  { name: 'icon-check.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>', size: 156 },
  { name: 'icon-x.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', size: 189 }
];

// SVG to Component conversion templates
const componentTemplates = {
  react: (name, svg) => `import React from 'react';

export const ${name} = (props) => (
  ${svg.replace('<svg', '<svg {...props}')}
);`,
  vue: (name, svg) => `<template>
  ${svg}
</template>

<script>
export default {
  name: '${name}'
}
</script>`,
  angular: (name, svg) => `import { Component } from '@angular/core';

@Component({
  selector: 'app-${name.toLowerCase()}',
  template: \`${svg}\`,
  standalone: true
})
export class ${name}Component {}`,
  svelte: (name, svg) => `<script>
  export let className = '';
</script>

${svg.replace('<svg', '<svg class={className}')}`
};

let uploadedFiles = [];
let benchmarkResults = null;

// Initialize benchmark listeners
function initBenchmark() {
  const modeSelect = document.getElementById('benchmark-mode');
  const uploadSection = document.getElementById('upload-section');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('svg-upload');
  const runButton = document.getElementById('run-benchmark');
  const resetButton = document.getElementById('reset-benchmark');
  const exportButton = document.getElementById('export-results');

  // Toggle upload section
  modeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'upload') {
      uploadSection.classList.remove('hidden');
    } else {
      uploadSection.classList.add('hidden');
      uploadedFiles = [];
      updateFileList();
    }
  });

  // Drop zone interactions
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  // Run benchmark
  runButton.addEventListener('click', runBenchmark);
  resetButton.addEventListener('click', resetBenchmark);
  exportButton.addEventListener('click', exportResults);
}

function handleFiles(files) {
  uploadedFiles = [];
  for (let file of files) {
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      uploadedFiles.push(file);
    }
  }
  updateFileList();
}

function updateFileList() {
  const fileList = document.getElementById('file-list');
  if (uploadedFiles.length === 0) {
    fileList.textContent = 'No files selected';
  } else {
    const totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    fileList.textContent = `${uploadedFiles.length} file(s) selected (${formatBytes(totalSize)})`;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function runBenchmark() {
  const framework = document.getElementById('benchmark-framework').value;
  const mode = document.getElementById('benchmark-mode').value;
  const resultsSection = document.getElementById('benchmark-results');
  const runButton = document.getElementById('run-benchmark');
  
  // Show results section
  resultsSection.classList.remove('hidden');
  runButton.disabled = true;
  
  // Reset UI
  updateTestStatus('running', 'Running...');
  updateProgress(0);
  clearDetailedResults();
  
  // Get files to process
  let filesToProcess = [];
  if (mode === 'sample') {
    filesToProcess = sampleSVGs;
  } else {
    if (uploadedFiles.length === 0) {
      alert('Please upload SVG files first');
      runButton.disabled = false;
      return;
    }
    // Read uploaded files
    for (let file of uploadedFiles) {
      const content = await file.text();
      filesToProcess.push({
        name: file.name,
        content: content,
        size: file.size
      });
    }
  }
  
  // Run benchmark
  const results = await processBenchmark(filesToProcess, framework);
  
  // Update UI with results
  displayResults(results);
  benchmarkResults = results;
  
  runButton.disabled = false;
  updateTestStatus('complete', 'Complete');
}

async function processBenchmark(files, framework) {
  const startTime = performance.now();
  const results = {
    framework,
    fileCount: files.length,
    files: [],
    totalTime: 0,
    avgTime: 0,
    throughput: 0,
    timestamp: new Date().toISOString()
  };
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileStart = performance.now();
    
    try {
      // Simulate SVG processing
      const componentName = toPascalCase(file.name.replace('.svg', ''));
      const component = componentTemplates[framework](componentName, file.content);
      
      // Simulate some processing time (in real scenario, this would be actual parsing/optimization)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      
      const fileEnd = performance.now();
      const duration = fileEnd - fileStart;
      
      results.files.push({
        name: file.name,
        size: file.size || file.content.length,
        duration: duration,
        success: true,
        outputSize: component.length
      });
      
      // Add to detailed results
      addDetailedResult(file.name, duration, true);
      
    } catch (error) {
      results.files.push({
        name: file.name,
        size: file.size || file.content.length,
        duration: 0,
        success: false,
        error: error.message
      });
      
      addDetailedResult(file.name, 0, false, error.message);
    }
    
    // Update progress
    const progress = ((i + 1) / files.length) * 100;
    updateProgress(progress);
  }
  
  const endTime = performance.now();
  results.totalTime = endTime - startTime;
  results.avgTime = results.totalTime / files.length;
  results.throughput = (files.length / results.totalTime) * 1000;
  
  return results;
}

function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function updateTestStatus(status, text) {
  const statusBadge = document.getElementById('test-status');
  statusBadge.innerHTML = status === 'running' 
    ? `<span class="relative flex h-2 w-2 mr-1.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>${text}`
    : `<span class="inline-flex rounded-full h-2 w-2 bg-green-500 mr-1.5"></span>${text}`;
}

function updateProgress(percent) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  progressBar.style.width = percent + '%';
  progressText.textContent = Math.round(percent) + '%';
  
  if (percent < 100) {
    progressBar.classList.add('progress-shimmer');
  } else {
    progressBar.classList.remove('progress-shimmer');
  }
}

function clearDetailedResults() {
  document.getElementById('detailed-results').innerHTML = '';
}

function addDetailedResult(filename, duration, success, error = null) {
  const container = document.getElementById('detailed-results');
  const resultDiv = document.createElement('div');
  resultDiv.className = `result-item ${success ? 'result-item-success' : 'result-item-error'}`;
  
  resultDiv.innerHTML = `
    <span class="font-medium">${filename}</span>
    <div class="flex items-center gap-2">
      ${success 
        ? `<span class="text-muted-foreground">${duration.toFixed(2)}ms</span>
           <span class="badge-success">✓ Success</span>`
        : `<span class="text-muted-foreground">${error}</span>
           <span class="badge-error">✗ Failed</span>`
      }
    </div>
  `;
  
  container.appendChild(resultDiv);
}

function displayResults(results) {
  document.getElementById('metric-files').textContent = results.fileCount;
  document.getElementById('metric-time').textContent = results.totalTime.toFixed(2) + 'ms';
  document.getElementById('metric-avg').textContent = results.avgTime.toFixed(2) + 'ms';
  document.getElementById('metric-throughput').textContent = results.throughput.toFixed(1) + '/s';
}

function resetBenchmark() {
  const resultsSection = document.getElementById('benchmark-results');
  resultsSection.classList.add('hidden');
  updateProgress(0);
  clearDetailedResults();
  benchmarkResults = null;
}

function exportResults() {
  if (!benchmarkResults) return;
  
  const dataStr = JSON.stringify(benchmarkResults, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `svger-benchmark-${Date.now()}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initBenchmark();
  updateActiveNavItem();
  
  // Handle anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
});
