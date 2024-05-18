---
title: core/dev/gg-debugger.ui.ts
nav_order: 96
parent: Modules
---

## gg-debugger.ui overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgDebuggerUI (class)](#ggdebuggerui-class)
    - [setShowStats (method)](#setshowstats-method)
    - [setShowDebugControls (method)](#setshowdebugcontrols-method)
    - [makeSnapshot (method)](#makesnapshot-method)
    - [makePerformanceStatsSnapshot (method)](#makeperformancestatssnapshot-method)
    - [renderControls (method)](#rendercontrols-method)
    - [renderPerformanceStats (method)](#renderperformancestats-method)
    - [perfStatsMode (property)](#perfstatsmode-property)
    - [css (property)](#css-property)

---

# utils

## GgDebuggerUI (class)

**Signature**

```ts
export declare class GgDebuggerUI
```

### setShowStats (method)

**Signature**

```ts
public setShowStats(selectedWorld: GgWorld<any, any>, value: boolean)
```

### setShowDebugControls (method)

**Signature**

```ts
public setShowDebugControls(selectedWorld: GgWorld<any, any>, value: boolean)
```

### makeSnapshot (method)

**Signature**

```ts
private makeSnapshot(): RuntimeDataSnapshot
```

### makePerformanceStatsSnapshot (method)

**Signature**

```ts
private makePerformanceStatsSnapshot(): PerformanceStatsSnapshot
```

### renderControls (method)

**Signature**

```ts
private renderControls(debugControlsContainer: HTMLDivElement)
```

### renderPerformanceStats (method)

**Signature**

```ts
private renderPerformanceStats()
```

### perfStatsMode (property)

**Signature**

```ts
perfStatsMode: 'AVG' | 'PEAK'
```

### css (property)

**Signature**

```ts
css: string
```
