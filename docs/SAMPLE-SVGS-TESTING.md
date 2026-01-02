# 🧪 Interactive Testing with Sample SVGs

This package includes **500+ sample SVG files** and an interactive test utility to help you quickly evaluate svger-cli with real-world icons and logos.

## 📦 What's Included

The `assets/svges/` directory contains:
- **500+ popular brand logos** (Google, Facebook, GitHub, etc.)
- **Common UI icons** (home, user, settings, etc.)
- **Various SVG complexity levels** (simple shapes to complex paths)
- **Real-world test cases** (different SVG structures and attributes)

## 🚀 Quick Start

### Method 1: CLI Test Utility (Recommended)

After installing the package, you can run the interactive test utility:

```bash
# Install globally
npm install -g svger-cli

# Run test with default settings (React, 10 files)
test-svger

# Test with Vue and TypeScript
test-svger --framework=vue --typescript

# Test with Angular, processing 20 files
test-svger --framework=angular --count=20

# Process all available SVGs
test-svger --count=999
```

**Output:**
```
╔════════════════════════════════════════════════════════════════╗
║                    SVGER-CLI Test Utility                      ║
║                  Quick Test with Sample SVGs                   ║
╚════════════════════════════════════════════════════════════════╝

✓ Found 500+ sample SVG files

Sample SVGs (showing first 10):
  1. google.svg
  2. facebook.svg
  3. github.svg
  4. home.svg
  5. user.svg
  ... and 495+ more

Test Configuration:
  Framework: react
  Files to process: 10
  TypeScript: No
  Output directory: ./svger-test-output

Running command:
  svger-cli --input assets/svges --output ./svger-test-output --framework react

✓ Test completed successfully!
  Duration: 234ms
  Output: ./svger-test-output
```

### Method 2: Direct CLI Usage

Use the sample SVGs directly with svger-cli:

```bash
# Find the assets directory in your node_modules
svger-cli --input ./node_modules/svger-cli/assets/svges --output ./my-components

# Or if installed globally (location varies by system)
svger-cli --input $(npm root -g)/svger-cli/assets/svges --output ./my-components
```

### Method 3: Online Interactive Demo (No Install Required)

Try the **Live Benchmarking Tool** in your browser:

🌐 **[https://faezemohades.github.io/svger-cli/#live-benchmark](https://faezemohades.github.io/svger-cli/#live-benchmark)**

Features:
- ✅ Test with 10 pre-loaded sample SVGs
- ✅ Upload your own SVG files (drag & drop)
- ✅ Switch between frameworks (React, Vue, Angular, Svelte)
- ✅ Real-time performance metrics
- ✅ Export results as JSON
- ✅ See generated component code
- ✅ No installation required!

## 📚 Test Utility Options

```bash
test-svger [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--framework=<name>` | Framework to use (react, vue, angular, svelte, solid, lit, preact, react-native, vanilla) | `react` |
| `--count=<number>` | Number of SVG files to process | `10` |
| `--typescript` | Generate TypeScript components | `false` |
| `--help, -h` | Show help message | - |

## 🎯 Use Cases

### 1. **Quick Evaluation**
```bash
# Test before committing to use svger-cli
test-svger --count=5
```

### 2. **Framework Comparison**
```bash
# Compare output across frameworks
test-svger --framework=react --count=10
test-svger --framework=vue --count=10
test-svger --framework=angular --count=10
```

### 3. **Performance Benchmarking**
```bash
# Test with large batches
time test-svger --count=100
time test-svger --count=500
```

### 4. **TypeScript Generation**
```bash
# Test TypeScript output quality
test-svger --framework=react --typescript --count=20
```

### 5. **Integration Testing**
```bash
# Use in CI/CD pipelines
test-svger --count=50 && echo "✓ Integration test passed"
```

## 📁 Package Structure

```
svger-cli/
├── bin/
│   ├── svg-tool.js          # Main CLI
│   └── test-svger.js        # Test utility (NEW!)
├── assets/
│   └── svges/               # 500+ sample SVGs (NEW!)
│       ├── google.svg
│       ├── facebook.svg
│       ├── github.svg
│       └── ... 500+ more
├── dist/                    # Compiled code
└── package.json
```

## 💡 Tips

### Finding Sample SVGs Location

```bash
# If installed globally
npm root -g

# If installed locally
npm root

# Then navigate to svger-cli/assets/svges
```

### Using Specific SVGs

```bash
# Test with only brand logos
svger-cli --input ./node_modules/svger-cli/assets/svges --include="google|facebook|github" --output ./brands

# Test with specific file patterns
svger-cli --input ./node_modules/svger-cli/assets/svges --include=".*icon.*" --output ./icons
```

### Copying Sample SVGs

```bash
# Copy to your project for customization
cp -r ./node_modules/svger-cli/assets/svges ./my-test-svgs
svger-cli --input ./my-test-svgs --output ./components
```

## 🌐 Online Demo vs CLI Test

| Feature | Online Demo | CLI Test Utility |
|---------|-------------|------------------|
| **Installation** | None required | npm install needed |
| **Speed** | In-browser (slower) | Native (faster) |
| **File Count** | 10 samples or upload | 500+ included |
| **Frameworks** | 4 options | 9+ options |
| **Output** | View only | Real files |
| **Customization** | Limited | Full CLI options |
| **Use Case** | Quick preview | Development & testing |

**Recommendation:**
- 🌐 Use **Online Demo** for quick evaluation
- 💻 Use **CLI Test Utility** for serious testing

## 🎓 Example Workflow

```bash
# 1. Try online demo first
open https://faezemohades.github.io/svger-cli/#live-benchmark

# 2. Install if you like what you see
npm install -g svger-cli

# 3. Run quick test
test-svger

# 4. Check the output
cd svger-test-output
ls -la

# 5. Test with your framework
test-svger --framework=vue --typescript

# 6. Use with your real SVGs
svger-cli --input ./my-svgs --output ./components --framework=vue --typescript
```

## 📊 Sample SVGs Categories

The included SVGs cover various categories:

- **Brands**: Google, Facebook, GitHub, Twitter, LinkedIn, etc. (200+)
- **UI Icons**: Home, User, Settings, Search, etc. (100+)
- **Shapes**: Circles, Squares, Triangles, etc. (50+)
- **Tech Logos**: React, Vue, Angular, Docker, AWS, etc. (100+)
- **Misc**: Flags, Emojis, Symbols, etc. (50+)

## 🚨 Important Notes

1. **Sample SVGs are for testing only** - They are publicly available icons and logos. Check licensing before using in production.

2. **Not all SVGs may work perfectly** - Some complex SVGs might need manual adjustment. This is intentional to provide realistic test cases.

3. **Output directory** - The test utility creates `svger-test-output` in your current directory. You can delete it after testing.

4. **Package size** - Including 500+ SVGs adds ~2-3MB to the package. This is acceptable for a testing utility but be aware if disk space is critical.

## 🤝 Contributing

Have interesting SVG test cases? Contribute them!

```bash
# Fork the repo
git clone https://github.com/faezemohades/svger-cli
cd svger-cli

# Add your SVG to assets/svges/
cp your-test.svg assets/svges/

# Submit PR
git add assets/svges/your-test.svg
git commit -m "Add your-test.svg for testing"
git push
```

## 📖 More Information

- **Documentation**: [https://github.com/faezemohades/svger-cli](https://github.com/faezemohades/svger-cli)
- **Live Demo**: [https://faezemohades.github.io/svger-cli/#live-benchmark](https://faezemohades.github.io/svger-cli/#live-benchmark)
- **Issues**: [https://github.com/faezemohades/svger-cli/issues](https://github.com/faezemohades/svger-cli/issues)

---

**Happy Testing!** 🎉
