export default class LuxioUtil {

  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}