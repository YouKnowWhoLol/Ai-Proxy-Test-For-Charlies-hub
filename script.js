const form =
  document.getElementById(
    "proxyForm"
  );

const urlInput =
  document.getElementById(
    "url"
  );

const button =
  document.getElementById(
    "goButton"
  );

const buttonText =
  document.getElementById(
    "buttonText"
  );

const spinner =
  document.getElementById(
    "spinner"
  );

const errorBox =
  document.getElementById(
    "error"
  );

const successBox =
  document.getElementById(
    "success"
  );

const statusDot =
  document.getElementById(
    "statusDot"
  );

const statusText =
  document.getElementById(
    "statusText"
  );


function showError(message) {
  errorBox.textContent =
    message;

  errorBox.classList.remove(
    "hidden"
  );

  successBox.classList.add(
    "hidden"
  );
}


function showSuccess(message) {
  successBox.textContent =
    message;

  successBox.classList.remove(
    "hidden"
  );

  errorBox.classList.add(
    "hidden"
  );
}


function clearMessages() {
  errorBox.classList.add(
    "hidden"
  );

  successBox.classList.add(
    "hidden"
  );
}


function setLoading(loading) {

  button.disabled =
    loading;

  if (loading) {

    buttonText.classList.add(
      "hidden"
    );

    spinner.classList.remove(
      "hidden"
    );

  } else {

    buttonText.classList.remove(
      "hidden"
    );

    spinner.classList.add(
      "hidden"
    );
  }
}


async function checkServer() {

  try {

    const response =
      await fetch(
        "/api/status",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error();
    }

    statusDot.classList.add(
      "online"
    );

    statusDot.classList.remove(
      "offline"
    );

    statusText.textContent =
      "Proxy online";

  } catch {

    statusDot.classList.add(
      "offline"
    );

    statusDot.classList.remove(
      "online"
    );

    statusText.textContent =
      "Proxy offline";
  }
}


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    clearMessages();

    let url =
      urlInput.value.trim();

    if (!url) {

      showError(
        "Enter a website URL."
      );

      return;
    }


    /*
     * Automatically add HTTPS
     * when the user types:
     *
     * example.com
     */
    if (
      !url.startsWith(
        "http://"
      ) &&
      !url.startsWith(
        "https://"
      )
    ) {

      url =
        "https://" + url;
    }


    try {

      new URL(url);

    } catch {

      showError(
        "Please enter a valid URL."
      );

      return;
    }


    setLoading(true);


    try {

      const response =
        await fetch(
          "/api/proxy",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              url
            })
          }
        );


      const contentType =
        response.headers.get(
          "content-type"
        ) || "";


      if (!response.ok) {

        let message =
          `Proxy error (${response.status})`;


        if (
          contentType.includes(
            "application/json"
          )
        ) {

          const data =
            await response.json();

          if (data.error) {
            message =
              data.error;
          }
        }


        throw new Error(
          message
        );
      }


      const blob =
        await response.blob();


      const objectUrl =
        URL.createObjectURL(
          blob
        );


      const newWindow =
        window.open(
          objectUrl,
          "_blank"
        );


      if (!newWindow) {

        showError(
          "Your browser blocked the new tab. Allow pop-ups for this site."
        );

      } else {

        showSuccess(
          "Website loaded successfully."
        );
      }


      setTimeout(
        () => {
          URL.revokeObjectURL(
            objectUrl
          );
        },
        60000
      );


    } catch (error) {

      console.error(
        error
      );

      showError(
        error.message ||
        "The proxy request failed."
      );

    } finally {

      setLoading(false);
    }
  }
);


urlInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      form.requestSubmit();
    }
  }
);


checkServer();
