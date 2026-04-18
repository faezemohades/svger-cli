**ADR** How to implement correctly SVG Integration Methods in React

**Version: 1.0.0**  
**Date: 10/14/2025**  
**Author: Engineer Navid Rezadoost**  
**TDR Document ID: [TDR-SVG-INTRGRATION-METHODS-001](https://docs.google.com/document/d/1b04_V01xOvLiSMzuPdaRynANlnt2wYdJ_vjs9MAqtn4/edit?tab=t.0)**  
**Status**: Proposed

**Context**  
This service is responsible for managing svg files. Given the documentation provided in the TDR for implementing Method 3, which covers the weaknesses of svgr, it was decided to release this package as an open source service on npm.

**Similar Weaknesses That We Are Looking To Solve In This Process**

* Add more commands for more control and mastery over svg file management  
* Add different commands for rendering and rebuilding svg components with more control over files that we do not want to be rebuilt  
* Add a command to create a component for new files that are added  
* A command to componentize a specific svg  
* Add settings for files that should remain unchanged due to specific styling  
* Introduce the folder and run the build as \--watch as soon as a new svg file is added to the specified folder, the svg will be built automatically  
* Create a config file or command on the command line to specify the source file to monitor or process and specify the destination directory  
* Specify rules for building components in width and height dimensions and even styles that should be set as default

#### **Decision**

We will develop a custom SVG integration CLI and runtime service for React that:

* Watches directories for new SVG files.  
* Generates React components automatically with flexible configuration.  
* Allows selective rebuilds and fine-grained control over output styles and props.

#### **Rationale**

SVGR, while popular, has the following shortcomings:

* Lacks a flexible CLI API for selective component generation.  
* No built-in `--watch` mode for automatic builds on new file additions.  
* Limited support for default dimension and styling rules.  
* Difficult to exclude or lock specific SVGs from rebuilds.

#### **Consequences**

* More control and automation for developers.  
* Slightly increased setup complexity.  
* Responsibility to maintain a custom build tool.

## **Example Configuration and Commands**

**Include examples so developers can easily visualize the usage.**

### Example `.svgconfig.json`

| {  "source": "./src/assets/svg",  "output": "./src/components/icons",  "watch": true,  "defaultWidth": "24",  "defaultHeight": "24",  "defaultFill": "currentColor",  "exclude": \["logo.svg", "brand-icon.svg"\],  "styleRules": {    "fill": "inherit",    "stroke": "none"  }} |
| :---- |

**Commands**

**Build Command**  
Builds React components from all SVG files in the specified source directory.

| svg-tool build \[options\] |
| :---- |

| svg-tool build \--src ./src/assets/svg \--out ./src/components/icons |
| :---- |

### **What It Does**

* Converts every `.svg` in the source folder to a React component.  
* Applies rules from `.svgconfig.json` if present.  
* Generates file names based on kebab-case or PascalCase (configurable).

**Watch Command**  
Continuously watches the source directory for new or updated SVG files, and automatically builds them.

| svg-tool watch \[options\] |
| :---- |

| svg-tool watch \--src ./src/assets/svg \--out ./src/components/icons |
| :---- |

### **What It Does**

* Automatically rebuilds when an SVG file is added, updated, or removed.  
* Skips locked SVG files.  
* Ideal for active development environments.

## **Generate Command**

Converts a specific SVG file into a React component on demand.

| svg-tool generate \<svgFile\> \[options\] |
| :---- |

| svg-tool generate ./src/assets/svg/heart.svg \--out ./src/components/icons |
| :---- |

### **What It Does**

* Converts only the specified file.  
* Ideal for adding individual icons to an existing collection.

## **Lock Command**

Locks one or more SVG files to prevent them from being rebuilt or overwritten during batch operations.

| svg-tool lock \<svgFile\> \[options\] |
| :---- |

| svg-tool lock ./src/assets/svg/logo.svg |
| :---- |

### **What It Does**

* Adds the specified file(s) to a `.svg-lock` or `.svgconfig.json` list.  
* Protects specific SVGs with custom branding or styling.


## **Unlock Command**

Unlocks one or more SVG files previously marked as locked, allowing them to be rebuilt.

| svg-tool unlock \<svgFile\> \[options\] |
| :---- |

| svg-tool unlock ./src/assets/svg/logo.svg |
| :---- |

## **Config Command**

Creates or modifies a `.svgconfig.json` file with default settings for builds and watches.

| svg-tool config \[options\] |
| :---- |

| svg-tool config \--init |
| :---- |

**\--init**

| svg-tool config \--init |
| :---- |

**\--set \<key=value\>**

| svg-tool config \--set defaultWidth=32 |
| :---- |

**`--show`**

| svg-tool config \--show |
| :---- |

**`Full One-Line Command Closet (for Bash / Mac / Linux / PowerShell)`**

| svg-tool config \--init && svg-tool config \--set source=./src/assets/svg && svg-tool config \--set output=./src/components/icons && svg-tool config \--set watch=true && svg-tool config \--set defaultWidth=24 && svg-tool config \--set defaultHeight=24 && svg-tool config \--set defaultFill=currentColor && svg-tool lock ./src/assets/svg/logo.svg && svg-tool build \--src ./src/assets/svg \--out ./src/components/icons \--verbose && svg-tool generate ./src/assets/svg/new-icon.svg \--out ./src/components/icons && svg-tool unlock ./src/assets/svg/logo.svg && svg-tool watch \--src ./src/assets/svg \--out ./src/components/icons && svg-tool clean \--out ./src/components/icons |
| :---- |

