/**
 * Type definitions for svger-cli
 */

export type FrameworkType =
  | 'react'
  | 'react-native'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'solid'
  | 'preact'
  | 'lit'
  | 'vanilla';

export type NamingConvention = 'kebab' | 'pascal' | 'camel';
export type ComponentType = 'functional' | 'class' | 'arrow';
export type ErrorHandlingStrategy = 'continue' | 'stop' | 'retry';
export type PerformanceOptimization = 'fast' | 'balanced' | 'maximum';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ChangeDetectionStrategy = 'Default' | 'OnPush';
export type ViewEncapsulation = 'Emulated' | 'None' | 'ShadowDom';

export interface OutputConfig {
  naming?: NamingConvention;
  extension?: string;
  directory?: string;
}

export interface ResponsiveConfig {
  breakpoints: string[];
  values: {
    [property: string]: string[];
  };
}

export interface ThemeConfig {
  mode: ThemeMode;
  variables: {
    [name: string]: string;
  };
}

export interface ErrorHandlingConfig {
  strategy: ErrorHandlingStrategy;
  maxRetries: number;
  timeout: number;
}

export interface PerformanceConfig {
  optimization: PerformanceOptimization;
  memoryLimit: number;
  cacheTimeout: number;
}

export interface ReactConfig {
  componentType?: ComponentType;
  forwardRef?: boolean;
  memo?: boolean;
  propsInterface?: string;
  styledComponents?: boolean;
  cssModules?: boolean;
}

export interface VueConfig {
  api?: 'composition' | 'options';
  setup?: boolean;
  typescript?: boolean;
  scoped?: boolean;
  cssVariables?: boolean;
}

export interface AngularConfig {
  standalone?: boolean;
  signals?: boolean;
  changeDetection?: ChangeDetectionStrategy;
  encapsulation?: ViewEncapsulation;
}

export interface SVGConfig {
  // Source & Output
  source: string;
  output: string;

  // Framework Configuration
  framework: FrameworkType;
  typescript: boolean;
  componentType?: ComponentType;

  // Processing Options
  watch: boolean;
  parallel: boolean;
  batchSize: number;
  maxConcurrency: number;
  cache: boolean;

  // Default Properties
  defaultWidth: number;
  defaultHeight: number;
  defaultFill: string;
  defaultStroke?: string;
  defaultStrokeWidth?: number;

  // Styling Configuration
  styleRules: {
    [property: string]: string;
  };

  responsive?: ResponsiveConfig;
  theme?: ThemeConfig;
  animations?: string[];

  // Advanced Options
  plugins: PluginConfig[];
  exclude: string[];
  include?: string[];

  // Error Handling
  errorHandling: ErrorHandlingConfig;

  // Performance Settings
  performance: PerformanceConfig;

  // Output Customization
  outputConfig: OutputConfig;

  // Framework-specific configurations
  react?: ReactConfig;
  vue?: VueConfig;
  angular?: AngularConfig;
}

export interface FrameworkOptions {
  // Vue-specific
  composition?: boolean;
  setup?: boolean;
  scriptSetup?: boolean;

  // Angular-specific
  standalone?: boolean;
  moduleImport?: boolean;

  // Solid-specific
  signals?: boolean;

  // React/Preact-specific
  forwardRef?: boolean;
  memo?: boolean;

  // Lit-specific
  customElement?: boolean;
  shadowDom?: boolean;

  // General
  cssModules?: boolean;
  styledComponents?: boolean;
}

export interface BuildOptions {
  src: string;
  out: string;
  config?: Partial<SVGConfig>;
}

export interface GenerateOptions {
  svgFile: string;
  outDir: string;
  config?: Partial<SVGConfig>;
}

export interface WatchOptions {
  src: string;
  out: string;
  config?: Partial<SVGConfig>;
}

export interface ComponentGenerationOptions {
  componentName: string;
  svgContent: string;
  framework: FrameworkType;
  typescript: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultFill?: string;
  styleRules?: Record<string, string>;
  template?: TemplateConfig;
  frameworkOptions?: FrameworkOptions;
  namingConvention?: 'kebab' | 'pascal' | 'camel';
}

export interface TemplateConfig {
  type: 'default' | 'custom';
  path?: string;
  options?: Record<string, any>;
}

export interface PluginConfig {
  name: string;
  options?: Record<string, any>;
}

export interface SVGProcessorResult {
  success: boolean;
  componentName: string;
  filePath: string;
  error?: Error;
}

export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  timestamp: number;
}

export interface ProcessingContext {
  config: SVGConfig;
  sourceDir: string;
  outputDir: string;
  fileQueue: string[];
  locks: Set<string>;
  cache?: Map<string, CachedComponent>;
}

export interface CachedComponent {
  hash: string;
  componentName: string;
  filePath: string;
  framework: FrameworkType;
  timestamp: number;
  svgHash: string;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface Plugin {
  name: string;
  version: string;
  process(content: string, options?: any): Promise<string>;
  validate?(options?: any): boolean;
}

export interface Template {
  name: string;
  generate(options: ComponentGenerationOptions): string;
  validate?(options: ComponentGenerationOptions): boolean;
}

export type FileSystemEvent = 'change' | 'rename';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ProcessingJob {
  id: string;
  filePath: string;
  status: ProcessingStatus;
  startTime: number;
  endTime?: number;
  error?: Error;
}

// Re-export integration types
export * from './integrations.js';
