const express = require("express");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

const app = express();

/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

const PORT = 3000;

/*
 * Add the domains that YOUR proxy is allowed to access.
 *
 * Examples:
 *
 * "example.com"
 * "www.example.com"
 *
 * Subdomains are automatically allowed too.
 */
const ALLOWED_HOSTS = [
  "example.com",
  "www.example.com"
];

/*
|--------------------------------------------------------------------------
| EXPRESS SETUP
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "10kb"
  })
);

app.use(
  express.static(__dirname)
);

/*
|--------------------------------------------------------------------------
| PRIVATE IP PROTECTION
|--------------------------------------------------------------------------
*/

function isPrivateIPv4(ip) {
  const parts = ip
    .split(".")
    .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(Number.isNaN)
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}


function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();

  return (
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:")
  );
}


async function resolvesToPrivateAddress(hostname) {
  try {
    const addresses =
      await dns.lookup(
        hostname,
        {
          all: true,
          verbatim: true
        }
      );

    return addresses.some(
      ({ address }) => {
        if (net.isIPv4(address)) {
          return isPrivateIPv4(
            address
          );
        }

        if (net.isIPv6(address)) {
          return isPrivateIPv6(
            address
          );
        }

        return true;
      }
    );
  } catch {
    /*
     * If DNS cannot be resolved,
     * fail closed.
     */
    return true;
  }
}


/*
|--------------------------------------------------------------------------
| ALLOWLIST
|--------------------------------------------------------------------------
*/

function isAllowedHostname(hostname) {
  const host =
    hostname.toLowerCase();

  return ALLOWED_HOSTS.some(
    allowed => {
      const domain =
        allowed.toLowerCase();

      return (
        host === domain ||
        host.endsWith("." + domain)
      );
    }
  );
}


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      online: true,
      name: "Fast Proxy"
    });
  }
);


/*
|--------------------------------------------------------------------------
| PROXY
|--------------------------------------------------------------------------
*/

app.post(
  "/api/proxy",
  async (req, res) => {
    try {
      if (
        !req.body ||
        typeof req.body.url !== "string"
      ) {
        return res.status(400).json({
          error:
            "A URL is required."
        });
      }

      let input =
        req.body.url.trim();

      /*
       * Prevent extremely large
       * URLs.
       */
      if (input.length > 2048) {
        return res.status(400).json({
          error:
            "URL is too long."
        });
      }

      /*
       * Make URLs such as
       * example.com work.
       */
      if (
        !input.startsWith(
          "http://"
        ) &&
        !input.startsWith(
          "https://"
        )
      ) {
        input =
          "https://" + input;
      }

      let target;

      try {
        target =
          new URL(input);
      } catch {
        return res.status(400).json({
          error:
            "Invalid URL."
        });
      }

      /*
       * Only normal web protocols.
       */
      if (
        target.protocol !== "http:" &&
        target.protocol !== "https:"
      ) {
        return res.status(400).json({
          error:
            "Only HTTP and HTTPS are supported."
        });
      }

      const hostname =
        target.hostname.toLowerCase();

      /*
       * Check allowlist.
       */
      if (
        !isAllowedHostname(
          hostname
        )
      ) {
        return res.status(403).json({
          error:
            "This website is not allowed by this proxy."
        });
      }

      /*
       * Prevent requests to
       * internal/private networks.
       */
      if (
        await resolvesToPrivateAddress(
          hostname
        )
      ) {
        return res.status(403).json({
          error:
            "Private or internal addresses are blocked."
        });
      }

      /*
       * Abort slow requests.
       */
      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => {
            controller.abort();
          },
          15000
        );

      try {
        const response =
          await fetch(
            target.toString(),
            {
              method: "GET",

              redirect: "follow",

              signal:
                controller.signal,

              headers: {
                "User-Agent":
                  "FastProxy/1.0"
              }
            }
          );

        const contentType =
          response.headers.get(
            "content-type"
          ) ||
          "application/octet-stream";

        const body =
          await response.arrayBuffer();

        res.status(
          response.status
        );

        res.set(
          "Content-Type",
          contentType
        );

        res.set(
          "Cache-Control",
          "no-store"
        );

        res.set(
          "X-Proxy-Status",
          "OK"
        );

        res.send(
          Buffer.from(body)
        );

      } finally {
        clearTimeout(
          timeout
        );
      }

    } catch (error) {
      console.error(
        "Proxy error:",
        error.message
      );

      if (
        error.name ===
        "AbortError"
      ) {
        return res.status(504).json({
          error:
            "The destination took too long to respond."
        });
      }

      return res.status(502).json({
        error:
          "The proxy could not reach the destination."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| MAIN PAGE
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "Not found."
    });
  }
);


/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "=============================="
    );
    console.log(
      "       FAST PROXY ONLINE"
    );
    console.log(
      "=============================="
    );
    console.log("");

    console.log(
      `http://localhost:${PORT}`
    );

    console.log("");

    console.log(
      "Allowed domains:"
    );

    for (
      const host of ALLOWED_HOSTS
    ) {
      console.log(
        `  - ${host}`
      );
    }

    console.log("");
  }
);
