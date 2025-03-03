const n = 624
const m = 397
const f = 1812433253
const w = 32
const r = 31
const UMASK = (0xffffffff << r) >>> 0
const LMASK = (0xffffffff >> (w - r)) >>> 0
const a = 0x9908b0df >>> 0
const u = 11
const s = 7
const t = 15
const l = 18
const b = 0x9d2c5680 >>> 0
const c = 0xefc60000 >>> 0

// A simple Merseene Twister implementation
// https://en.wikipedia.org/wiki/Mersenne_Twister
export class PseudoRandomNumberGenerator {
  private state: Uint32Array
  private index: number
  private _seed: number

  constructor(seed?: number) {
    this.state = new Uint32Array(n)
    this.index = 0
    this._seed = seed ?? Math.floor(Math.random() * Math.pow(2, 31))

    this.init(this._seed)
  }

  private init(seed: number): void {
    this.state[0] = seed
    for (let i = 1; i < n; i++) {
      seed = ((f * seed) ^ ((seed >> (w - 2)) + i)) >>> 0
      this.state[i] = seed
    }
    this.index = 0
  }

  public seed(seed: number): void {
    this._seed = seed
    this.init(seed)
  }

  public getSeed() {
    return this._seed
  }

  public nextInt(): number {
    let k = this.index
    let j = k - (n - 1)
    if (j < 0) {
      j += n
    }

    let x = ((this.state[k]! & UMASK) | (this.state[j]! & LMASK)) >>> 0
    let xA = (x >> 1) >>> 0
    if (x & 0x00000001) {
      xA ^= a
      xA >>>= 0
    }

    j = k - (n - m)
    if (j < 0) {
      j += n
    }

    x = (this.state[j]! ^ xA) >>> 0
    this.state[k++] = x
    if (k >= n) {
      k = 0
    }
    this.index = k
    let y = (x ^ (x >> u)) >>> 0
    y = (y ^ ((y << s) & b)) >>> 0
    y = (y ^ ((y << t) & c)) >>> 0
    const z = (y ^ (y >> l)) >>> 0
    return z
  }
}
