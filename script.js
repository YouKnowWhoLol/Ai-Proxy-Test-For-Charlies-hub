const form = document.getElementById("proxyForm");
const urlInput = document.getElementById("url");
const statusBox = document.getElementById("status");
const errorBox = document.getElementById("error");
const button = form.querySelector("button");

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  clearError();

  const url = urlInput.value.trim();

  if (!url) {
    showError("Enter a URL.");
    return;
  }

  try {
    new URL(url);
  } catch {
    showError("Please enter a valid URL.");
    return;
  }

  button.disabled = true;
  button.textContent = "Loading...";
  statusBox.textContent = "Connecting...";

  try {
    const response = await fetch("/api/proxy", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        url
      })
    });

    const contentType =
      response.headers.get("content-type") || "";

    if (!response.ok) {
      let message =
        `Proxy error (${response.status})`;

      if (contentType.includes("application/json")) {
        const data = await response.json();

        if (data.error) {
          message = data.error;
        }
      }

      throw new Error(message);
    }

    const blob = await response.blob();

    const objectUrl =
      URL.createObjectURL(blob);

    window.open(
      objectUrl,
      "_blank"
    );

    statusBox.textContent =
      "Request completed.";
  } catch (error) {
    statusBox.textContent =
      "Request failed.";

    showError(
      error.message ||
      "Something went wrong."
    );
  } finally {
    button.disabled = false;
    button.textContent = "Go";
  }
});
