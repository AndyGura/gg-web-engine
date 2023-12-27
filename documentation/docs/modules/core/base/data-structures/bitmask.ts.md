---
title: core/base/data-structures/bitmask.ts
nav_order: 71
parent: Modules
---

## bitmask overview

BitMask class provides static methods to manipulate bits in a number.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BitMask (class)](#bitmask-class)
    - [full (static method)](#full-static-method)
    - [fullArray (static method)](#fullarray-static-method)
    - [pack (static method)](#pack-static-method)
    - [unpack (static method)](#unpack-static-method)

---

# utils

## BitMask (class)

BitMask class provides static methods to manipulate bits in a number.

**Signature**

```ts
export declare class BitMask
```

### full (static method)

Generates a bitmask with all bits set to 1 upto the provided bit count

**Signature**

```ts
static full(bits: number)
```

### fullArray (static method)

Generates an array with elements being consecutive numbers starting from 0 up to the provided number

**Signature**

```ts
static fullArray(bits: number)
```

### pack (static method)

Packs an array of bit indices into a single number

**Signature**

```ts
static pack(value: number[], bits: number)
```

### unpack (static method)

Unpacks a bitmask into an array of bit indices

**Signature**

```ts
static unpack(mask: number, bits: number)
```
