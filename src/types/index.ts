/**
 * Type definitions for svger-cli
 */


export type FrameworkType =
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'solid'
  | 'preact'
  | 'lit'
  | 'vanilla'
  | 'react-native';

export type NamingConvention = 'kebab' | 'pascal' | 'camel';

export interface OutputConfig {
  naming?: NamingConvention;
  extension?: string;
  directory?: string;
}


export interface SVGConfig {
  source: string;
  output: string | OutputConfig;
  watch: boolean;
  framework: FrameworkType;
  typescript: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultFill: string;
  exclude: string[];
  styleRules: {
    fill?: string;
    stroke?: string;
    [key: string]: string | undefined;
  };
  plugins?: PluginConfig[];
  template?: TemplateConfig;
  frameworkOptions?: FrameworkOptions;
  errorHandling?: {
    skipOnError: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxRetries: number;
  };
  performance?: {
    batchSize: number;
    parallel: boolean;
    timeout: number;
    enableCache: boolean;
  };
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
