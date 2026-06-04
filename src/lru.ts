export class LRUMap<K, V> extends Map<K, V> {
  private max: number;
  private order: K[] = [];

  constructor(max: number) {
    super();
    this.max = max;
  }

  set(key: K, value: V): this {
    if (this.has(key)) {
      this.order = this.order.filter(k => k !== key);
    } else if (this.order.length >= this.max) {
      const evict = this.order.shift()!;
      this.delete(evict);
    }
    this.order.push(key);
    return super.set(key, value);
  }

  get(key: K): V | undefined {
    if (this.has(key)) {
      this.order = this.order.filter(k => k !== key);
      this.order.push(key);
    }
    return super.get(key);
  }
}
