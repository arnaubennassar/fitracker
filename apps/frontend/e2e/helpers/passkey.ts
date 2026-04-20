import type { Page } from "@playwright/test";

export async function installPasskeyStub(page: Page) {
  await page.addInitScript(() => {
    class FakeAttestationResponse {
      clientDataJSON = new TextEncoder().encode("client").buffer;

      getPublicKey() {
        return new Uint8Array([9, 10, 11, 12]).buffer;
      }

      getTransports() {
        return ["internal"];
      }
    }

    class FakeAssertionResponse {
      authenticatorData = new Uint8Array([1, 2, 3, 4]).buffer;
      clientDataJSON = new TextEncoder().encode("client").buffer;
      signature = new Uint8Array([5, 6, 7, 8]).buffer;
    }

    class FakePublicKeyCredential {
      id = "cred_e2e";
      response;

      constructor(mode = "login") {
        this.response =
          mode === "register"
            ? new FakeAttestationResponse()
            : new FakeAssertionResponse();
      }
    }

    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: FakePublicKeyCredential,
    });
    Object.defineProperty(window, "AuthenticatorAttestationResponse", {
      configurable: true,
      value: FakeAttestationResponse,
    });
    Object.defineProperty(window, "AuthenticatorAssertionResponse", {
      configurable: true,
      value: FakeAssertionResponse,
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        async create() {
          return new FakePublicKeyCredential("register");
        },
        async get() {
          return new FakePublicKeyCredential("login");
        },
      },
    });
  });
}
