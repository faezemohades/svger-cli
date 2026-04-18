# SVGER-CLI v4.0.0 Performance Report

**Date:** 2026-01-02T13:32:58.911Z
**Node.js:** v24.4.1
**Platform:** linux x64

## Test Results

**Input:** 606 SVG files (1.01MB)

| Test | Time | Files | Speed/File | Memory | Throughput |
|------|------|-------|------------|--------|-----------|
| React Components (TypeScript) | 30.28s | 607 | 49.88ms | 0.21MB | 20.05 files/sec |
| React (Parallel Processing) | 30.34s | 607 | 49.98ms | -0.78MB | 20.01 files/sec |
| Vue 3 (Composition API) | 30.32s | 606 | 50.04ms | 0.16MB | 19.99 files/sec |
| Angular (Standalone) | 30.29s | 607 | 49.89ms | 0.16MB | 20.04 files/sec |

## Summary

- **Average Time:** 30.31s
- **Average Per File:** 50.01ms
- **Average Memory:** -0.06MB
- **Throughput:** 20.00 files/sec

## vs Competitors

| Tool | Time | Memory | Improvement |
|------|------|--------|-------------|
| **SVGER v4.0.0** | **30.31s** | **-0.06MB** | **Baseline** |
| SVGR (estimated) | 63.64s | -0.21MB | 52% slower |
| SVGO (estimated) | 45.46s | -0.14MB | 33% slower |
