# Live Benchmarking Feature - Test Guide

## ✨ New Feature: Interactive Benchmark Testing

The documentation site now includes a **Live Performance Testing** section where users can test SVG processing performance directly in their browser!

## 🎯 Features

### 1. **Sample SVG Testing**
- Pre-loaded with 10 sample SVG icons
- No file upload required
- Instant testing

### 2. **Custom SVG Upload**
- Drag & drop SVG files
- Multiple file support
- Shows file count and total size

### 3. **Multi-Framework Support**
- React
- Vue 3
- Angular
- Svelte

### 4. **Real-Time Metrics**
- Files processed count
- Total processing time
- Average time per file
- Throughput (files/second)

### 5. **Detailed Results**
- Per-file processing times
- Success/failure status
- Visual progress bar
- Live status updates

### 6. **Export Capability**
- Export results as JSON
- Includes all metrics and file details
- Timestamped for record-keeping

## 🧪 Testing the Feature

### Test 1: Sample SVGs (Quick Test)

1. **Navigate to Live Benchmarking section:**
   ```
   http://localhost:8000#live-benchmark
   ```

2. **Configuration:**
   - Framework: React (default)
   - Test Mode: Sample SVGs (10 icons)

3. **Run Test:**
   - Click "Run Benchmark Test"
   - Watch progress bar
   - View real-time results

4. **Expected Results:**
   - 10 files processed
   - ~100-200ms total time
   - ~10-20ms per file
   - All files success ✓

### Test 2: Upload Custom SVGs

1. **Configuration:**
   - Framework: Vue 3
   - Test Mode: Upload Your SVGs

2. **Upload Files:**
   - Click drop zone or drag & drop
   - Upload 5-10 SVG files
   - Verify file count displays

3. **Run Test:**
   - Click "Run Benchmark Test"
   - Monitor detailed results
   - Check each file status

4. **Expected Results:**
   - All uploaded files processed
   - Individual file times shown
   - Success badges for each

### Test 3: Framework Comparison

Run the same SVGs across different frameworks:

1. **React:** Run benchmark
2. **Vue:** Change framework, run again
3. **Angular:** Change framework, run again
4. **Svelte:** Change framework, run again

5. **Compare Results:**
   - Processing times should be similar
   - Component templates differ by framework
   - Export each result for comparison

### Test 4: Export Results

1. **After running a benchmark:**
   - Click "Export Results (JSON)"
   - File downloads automatically
   - Filename: `svger-benchmark-[timestamp].json`

2. **Verify JSON contents:**
   ```json
   {
     "framework": "react",
     "fileCount": 10,
     "files": [...],
     "totalTime": 150.23,
     "avgTime": 15.02,
     "throughput": 66.54,
     "timestamp": "2026-01-02T..."
   }
   ```

## 📊 Sample Test Results

### Expected Performance Metrics

**Sample SVGs (10 files):**
- Total Time: 100-300ms
- Avg Per File: 10-30ms
- Throughput: 30-100 files/s
- Success Rate: 100%

**Custom Upload (20 files):**
- Total Time: 200-600ms
- Avg Per File: 10-30ms
- Throughput: 30-100 files/s
- Success Rate: 95-100%

## 🎨 UI Elements

### Progress Bar
- Animates from 0% to 100%
- Green shimmer effect while running
- Shows percentage text

### Status Badge
- Running: Animated ping indicator
- Complete: Static green dot

### Metrics Cards
- Files Processed: Total count
- Total Time: In milliseconds
- Avg Per File: In milliseconds
- Throughput: Files per second

### Detailed Results
- Green border: Success
- Red border: Failed
- Shows filename and duration
- Success/Failed badges

## 🔍 How It Works

### 1. **File Selection**
```javascript
// Sample mode: Uses pre-loaded SVGs
sampleSVGs = [
  { name: 'icon-home.svg', content: '...', size: 245 },
  // ... 10 total icons
];

// Upload mode: Reads user files
File API → FileReader → Process
```

### 2. **SVG Processing Simulation**
```javascript
// For each SVG:
1. Parse filename → Component name (PascalCase)
2. Apply framework template
3. Measure processing time
4. Generate component code
5. Track success/failure
```

### 3. **Framework Templates**
```javascript
componentTemplates = {
  react: (name, svg) => `import React...`,
  vue: (name, svg) => `<template>...`,
  angular: (name, svg) => `@Component...`,
  svelte: (name, svg) => `<script>...`
}
```

### 4. **Metrics Calculation**
```javascript
totalTime = endTime - startTime
avgTime = totalTime / fileCount
throughput = (fileCount / totalTime) * 1000
```

## 🐛 Troubleshooting

### Issue: No files uploaded
**Solution:** Click "Upload Your SVGs" and select files

### Issue: Benchmark not running
**Solution:** Check browser console (F12) for errors

### Issue: Progress stuck at 0%
**Solution:** Refresh page and try again

### Issue: Export not working
**Solution:** Check browser's download settings

## 📱 Mobile Testing

The benchmark feature is **responsive**:
- Works on tablets (768px+)
- Limited on mobile (<768px)
- Best experience on desktop

## ♿ Accessibility

- Keyboard navigation supported
- ARIA labels on interactive elements
- Status updates announced
- Color contrast compliant

## 🚀 Future Enhancements

Potential additions:
- [ ] Memory usage tracking
- [ ] File size comparison (input vs output)
- [ ] Multiple framework comparison charts
- [ ] Historical benchmark tracking
- [ ] Share results via URL
- [ ] WebWorker processing for better performance

## 📝 Technical Details

### Technologies Used
- **HTML5 File API** - File upload
- **Performance API** - Accurate timing
- **Blob API** - Export functionality
- **Vanilla JavaScript** - No dependencies
- **CSS Animations** - Progress effects

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Performance
- Lightweight: ~2KB additional JS
- No external dependencies
- Runs entirely in browser
- No server communication

## 🎉 Summary

The Live Benchmarking feature provides:

✅ **Interactive testing** without CLI installation  
✅ **Real-time metrics** with visual feedback  
✅ **Multi-framework** comparison capability  
✅ **Export functionality** for record-keeping  
✅ **User-friendly UI** with drag & drop  
✅ **Zero dependencies** - runs in browser  

Perfect for:
- Quick performance checks
- Framework comparisons
- Demo purposes
- Validation before installation
- Educational purposes

---

**Test it now:** http://localhost:8000#live-benchmark
