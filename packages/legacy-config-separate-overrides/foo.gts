export default class Foo {
  get foo(): true | undefined {
    if (Math.random() > 0.5) {
      return true;
    }
  }
}
