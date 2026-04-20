import type { Page } from "@playwright/test";

export async function installPasskeyStub(page: Page) {
  await page.addInitScript(() => {
    class FakeAssertionResponse {
      authenticatorData = new Uint8Array([1, 2, 3, 4]).buffer;
      clientDataJSON = new TextEncoder().encode("client").buffer;
      signature = new Uint8Array([5, 6, 7, 8]).buffer;
    }

    class FakePublicKeyCredential {
      id = "cred_e2e";
      response = new FakeAssertionResponse();
    }

    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: FakePublicKeyCredential,
    });
    Object.defineProperty(window, "AuthenticatorAssertionResponse", {
      configurable: true,
      value: FakeAssertionResponse,
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        async get() {
          return new FakePublicKeyCredential();
        },
      },
    });
  });
}
