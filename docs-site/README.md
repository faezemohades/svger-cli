# SVGer CLI Documentation Site

This directory contains the static documentation website for SVGer CLI, deployed to GitHub Pages.

## 📁 Structure

```
docs-site/
├── index.html      # Main documentation page
├── styles.css      # Compiled styles (Tailwind-inspired)
└── script.js       # Interactive features (navigation, code copying)
```

## 🚀 Local Development

To test the documentation locally:

```bash
# Option 1: Using Python's built-in server
cd docs-site
python3 -m http.server 8000

# Option 2: Using Node's http-server
npx http-server docs-site -p 8000

# Option 3: Using PHP
cd docs-site
php -S localhost:8000
```

Then open http://localhost:8000 in your browser.

## 🌐 Deployment

The site is automatically deployed to GitHub Pages on every push to the `main` branch via GitHub Actions.

### Manual Deployment Setup

1. **Enable GitHub Pages:**
   - Go to your repository Settings → Pages
   - Source: GitHub Actions
   - The workflow will automatically deploy from the `docs-site/` directory

2. **GitHub Actions Workflow:**
   - Located at `.github/workflows/deploy-docs.yml`
   - Automatically runs on push to main branch
   - Can also be triggered manually from Actions tab

3. **Access the site:**
   - After deployment: `https://faezemohades.github.io/svger-cli/`

## ✨ Features

- **Zero Build Step:** Pure HTML/CSS/JS - no build tools required
- **Responsive Design:** Works on all screen sizes
- **Dark Mode:** Automatic dark mode based on system preferences
- **Code Copying:** One-click code snippet copying
- **Smooth Navigation:** Collapsible sidebar with smooth scrolling
- **Performance:** Optimized for fast loading

## 🎨 Customization

### Update Content
Edit `index.html` directly - all content is in one file for simplicity.

### Modify Styles
Edit `styles.css` - uses CSS custom properties for easy theming.

### Add Interactivity
Edit `script.js` - vanilla JavaScript for all interactions.

## 📝 Content Sections

1. **Hero Section** - Introduction and key features
2. **Why SVGer CLI?** - Feature highlights
3. **Installation** - Setup instructions
4. **Quick Start** - Basic usage examples
5. **Build Tool Integrations** - Webpack, Vite, Next.js
6. **Feature Comparison** - vs SVGR and other tools
7. **Multi-Framework Support** - All supported frameworks
8. **Performance** - Real-world benchmarks
9. **Configuration** - Settings and options

## 🔧 Maintenance

### Update Version Number
Update the version badge in `index.html`:
```html
<span class="text-[10px] text-muted-foreground tracking-wider leading-none mt-0.5">v4.0.0</span>
```

### Update Performance Stats
Update the benchmark numbers in the Performance section with latest test results.

### Add New Sections
1. Add content to `index.html`
2. Add navigation items to `script.js` navigation array
3. Test locally before pushing

## 📦 Technologies

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Grid, Flexbox
- **Vanilla JavaScript** - No frameworks
- **Web Fonts** - Inter & JetBrains Mono from Google Fonts
- **SVG Icons** - Inline SVG for crisp rendering

## 🤝 Contributing

To improve the documentation:

1. Edit files in `docs-site/`
2. Test locally using one of the methods above
3. Submit a pull request with your changes

## 📄 License

MIT License - same as the main SVGer CLI project.
