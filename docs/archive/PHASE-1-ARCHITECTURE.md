# Phase 1 Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          svger-cli v4.0.0                          │
│                     Advanced SVG Optimizer                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLI Entry Point                             │
│  svger-cli build <src> <out> --optimize <level>                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          svg-service.ts                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ setOptimizerLevel(level: string)                              │ │
│  │  ├─ Validate level (none|basic|balanced|aggressive|maximum)  │ │
│  │  └─ Set processor optimization level                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        svg-processor.ts                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ private optimizer: OptimizerPipeline                          │ │
│  │                                                                │ │
│  │ async cleanSVGContent(svg: string): Promise<string>          │ │
│  │  ├─ Try optimizer.optimize(svg)                              │ │
│  │  ├─ Log reduction metrics                                    │ │
│  │  └─ Fallback to legacy on error                              │ │
│  │                                                                │ │
│  │ setOptimizationLevel(level: OptLevel)                        │ │
│  │  └─ Update optimizer config                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    src/optimizers/ Module                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  optimizer-pipeline.ts                        │ │
│  │  ┌────────────────────────────────────────────────────────┐  │ │
│  │  │ class OptimizerPipeline                                │  │ │
│  │  │  ├─ constructor(config?: Partial<OptConfig>)          │  │ │
│  │  │  ├─ registerStage(name, fn)                           │  │ │
│  │  │  ├─ async optimize(svg): Promise<OptimizationResult> │  │ │
│  │  │  ├─ getConfig(): OptConfig                            │  │ │
│  │  │  ├─ updateConfig(config)                              │  │ │
│  │  │  └─ clearStages()                                     │  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                       types.ts                                │ │
│  │  ├─ enum OptLevel (5 levels)                                 │ │
│  │  ├─ interface OptConfig (18+ options)                        │ │
│  │  ├─ interface OptimizationResult                             │ │
│  │  ├─ type OptimizationStage                                   │ │
│  │  └─ function getDefaultOptConfig(level)                      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    basic-cleaner.ts                           │ │
│  │  ├─ removeXMLDeclaration(svg, config)                        │ │
│  │  ├─ removeDoctype(svg, config)                               │ │
│  │  ├─ removeComments(svg, config)                              │ │
│  │  ├─ removeMetadata(svg, config)                              │ │
│  │  ├─ normalizeWhitespace(svg, config)                         │ │
│  │  ├─ removeXMLNamespaces(svg, config)                         │ │
│  │  ├─ removeInlineStyles(svg, config)                          │ │
│  │  ├─ convertToCamelCase(svg, config)                          │ │
│  │  ├─ shortenColors(svg, config)                               │ │
│  │  ├─ roundFloats(svg, config)                                 │ │
│  │  ├─ removeEmptyContainers(svg, config)                       │ │
│  │  ├─ removeHiddenElements(svg, config)                        │ │
│  │  ├─ sortAttributes(svg, config)                              │ │
│  │  └─ async basicCleaningStage(svg, config)                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Optimization Pipeline Flow

```
Input SVG (518 bytes)
    │
    ▼
┌─────────────────────────────────────────┐
│   OptimizerPipeline.optimize(svg)      │
└─────────────────────────────────────────┘
    │
    ├──► originalSize = Buffer.byteLength(svg)
    │
    ▼
┌─────────────────────────────────────────┐
│  Stage 1: Basic Cleaning                │
│  ┌─────────────────────────────────────┐│
│  │ removeXMLDeclaration                ││
│  │  └─ Remove <?xml ... ?>            ││
│  ├─────────────────────────────────────┤│
│  │ removeDoctype                       ││
│  │  └─ Remove <!DOCTYPE ...>          ││
│  ├─────────────────────────────────────┤│
│  │ removeComments                      ││
│  │  └─ Remove <!-- ... -->            ││
│  ├─────────────────────────────────────┤│
│  │ removeMetadata                      ││
│  │  └─ Remove <metadata>, <title>     ││
│  ├─────────────────────────────────────┤│
│  │ normalizeWhitespace                 ││
│  │  └─ Collapse spaces, newlines      ││
│  ├─────────────────────────────────────┤│
│  │ removeXMLNamespaces                 ││
│  │  └─ Remove xmlns attributes        ││
│  ├─────────────────────────────────────┤│
│  │ removeInlineStyles (if enabled)     ││
│  │  └─ Remove style="..."             ││
│  ├─────────────────────────────────────┤│
│  │ convertToCamelCase                  ││
│  │  └─ fill-rule → fillRule           ││
│  ├─────────────────────────────────────┤│
│  │ shortenColors                       ││
│  │  └─ #ffffff → #fff                 ││
│  ├─────────────────────────────────────┤│
│  │ roundFloats                         ││
│  │  └─ 1.234567 → 1.235               ││
│  ├─────────────────────────────────────┤│
│  │ removeEmptyContainers               ││
│  │  └─ Remove <g></g>, <defs></defs>  ││
│  ├─────────────────────────────────────┤│
│  │ removeHiddenElements (if enabled)   ││
│  │  └─ Remove opacity:0 elements      ││
│  ├─────────────────────────────────────┤│
│  │ sortAttributes (if enabled)         ││
│  │  └─ Sort attributes alphabetically  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Stage 2: Custom Stage (future)        │
│  (Not implemented in Phase 1)           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Calculate Metrics                      │
│  ├─ optimizedSize = Buffer.byteLength   │
│  ├─ reduction = (orig - opt) / orig     │
│  └─ reductionPercent = reduction * 100  │
└─────────────────────────────────────────┘
    │
    ▼
Output SVG (133 bytes)
    +
OptimizationResult {
  optimizedSvg: "...",
  originalSize: 518,
  optimizedSize: 133,
  reductionPercent: 74.32,
  stagesApplied: ["basic-cleaning"]
}
```

## Optimization Levels Configuration

```
┌──────────────────────────────────────────────────────────────┐
│                    OptLevel.NONE                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ removeMetadata: false                                  │ │
│  │ removeComments: false                                  │ │
│  │ normalizeWhitespace: false                             │ │
│  │ removeUnnecessaryAttrs: false                          │ │
│  │ shortenColors: false                                   │ │
│  │ Result: ~1% reduction                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    OptLevel.BASIC (Default)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ All basic optimizations: true                          │ │
│  │ floatPrecision: 3                                      │ │
│  │ removeHiddenElements: false                            │ │
│  │ mergePaths: false                                      │ │
│  │ collapseGroups: false                                  │ │
│  │ Result: ~74% reduction                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    OptLevel.BALANCED                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ BASIC settings +                                       │ │
│  │ removeHiddenElements: true                             │ │
│  │ floatPrecision: 3                                      │ │
│  │ Result: ~74% reduction                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    OptLevel.AGGRESSIVE                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ BALANCED settings +                                    │ │
│  │ mergePaths: true                                       │ │
│  │ collapseGroups: true                                   │ │
│  │ floatPrecision: 2                                      │ │
│  │ pathTolerance: 0.7                                     │ │
│  │ sortAttrs: true                                        │ │
│  │ Result: ~75% reduction                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    OptLevel.MAXIMUM                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ AGGRESSIVE settings +                                  │ │
│  │ inlineStyles: true                                     │ │
│  │ floatPrecision: 1                                      │ │
│  │ pathTolerance: 0.9                                     │ │
│  │ Result: ~75% reduction                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌───────────────────────────────────────────────────────────┐
│  SVGProcessor.cleanSVGContent(svg)                       │
└───────────────────────────────────────────────────────────┘
                    │
                    ▼
           ┌─────────────────┐
           │ Try optimizer?  │
           └─────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
      YES                      NO
        │                       │
        ▼                       ▼
┌───────────────┐     ┌──────────────────┐
│ Try optimize  │     │ Legacy cleaning  │
└───────────────┘     └──────────────────┘
        │                       │
        ▼                       │
   ┌─────────┐                 │
   │ Success?│                 │
   └─────────┘                 │
        │                      │
    ┌───┴───┐                  │
  YES      NO                  │
    │       │                  │
    │       ▼                  │
    │  ┌─────────────┐         │
    │  │ Log warning │         │
    │  │ Use legacy  │         │
    │  └─────────────┘         │
    │       │                  │
    └───────┴──────────────────┘
                │
                ▼
        ┌──────────────┐
        │ Return clean │
        │     SVG      │
        └──────────────┘
```

## Integration Points

```
┌──────────────────────────────────────────────────────────────┐
│                    User Entry Points                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CLI Command                                                 │
│  ├─ svger-cli build ... --optimize <level>                  │
│  └─ svger-cli generate ... --optimize <level>               │
│                                                              │
│  Programmatic API                                            │
│  ├─ svgService.buildAll({ optimize: 'level' })             │
│  ├─ svgService.generateSingle({ optimize: 'level' })       │
│  └─ svgProcessor.setOptimizationLevel(OptLevel.BALANCED)   │
│                                                              │
│  Direct Pipeline                                             │
│  ├─ createOptimizerPipeline(level)                          │
│  └─ pipeline.optimize(svg)                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Module Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                      Dependencies                            │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Native     │  │  TypeScript  │  │    Jest      │
│   Node.js    │  │   Compiler   │  │   Testing    │
└──────────────┘  └──────────────┘  └──────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │   ZERO RUNTIME DEPS!     │
              │   Pure Node.js Speed     │
              └──────────────────────────┘
```

## Future Phases Preview

```
Phase 1 (✅ Complete)
├─ Pluggable pipeline
├─ 5 optimization levels
├─ 13 cleaning functions
└─ CLI integration

Phase 2 (🔄 Planned)
├─ Path simplification
├─ Group collapse
├─ Transform optimization
└─ Duplicate removal

Phase 3 (🔮 Future)
├─ Virtual DOM tree
├─ AST-based transforms
├─ ML optimizations
└─ SVGO benchmark
```
