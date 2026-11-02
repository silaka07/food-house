// js/auth.js
(function () {
  "use strict";

  const API_URL = "https://restaurantapi.stepacademy.ge/api";
  const API_KEY = "dd15cb0c-e956-4f5b-b1c0-d4aaf3ac2053";

  const SESSION_KEY = "foodHouseApiSession";
  const REQUEST_TIMEOUT = 15000;

  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  // ---------- API ----------

  function getErrorMessage(body, status) {
    if (typeof body === "string" && body.trim() && body.length < 300) {
      return body.trim();
    }

    const errors = body?.errors;

    if (errors && typeof errors === "object") {
      const messages = Object.values(errors)
        .flat()
        .filter((value) => typeof value === "string" && value.trim());

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }

    if (typeof body?.message === "string" && body.message.trim()) {
      return body.message;
    }

    if (typeof body?.title === "string" && body.title.trim()) {
      return body.title;
    }

    switch (status) {
      case 400:
        return "სერვერმა მოთხოვნა უარყო. შეამოწმე შეყვანილი მონაცემები.";

      case 401:
        return "ავტორიზაცია ვერ მოხერხდა. შეამოწმე მონაცემები ან ხელახლა შედი.";

      case 403:
        return "ამ მოქმედებაზე წვდომა შეზღუდულია.";

      case 404:
        return "მოთხოვნილი რესურსი ვერ მოიძებნა.";

      case 409:
        return "მოთხოვნა არსებულ მონაცემებთან კონფლიქტშია.";

      case 429:
        return "ძალიან ბევრი მოთხოვნა გაიგზავნა. ცოტა ხანში სცადე.";

      default:
        return status >= 500
          ? "სერვერზე შეცდომაა. ცოტა ხანში სცადე თავიდან."
          : `მოთხოვნა ვერ შესრულდა (${status}).`;
    }
  }

  async function apiRequest(path, { method = "GET", body, token } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const headers = {
      Accept: "application/json",
      "X-STEP-KEY": API_KEY,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();
      let result = null;

      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          if (response.ok) {
            throw new ApiError("სერვერმა არასწორი ფორმატის პასუხი დააბრუნა.");
          }
        }
      }

      if (!response.ok) {
        console.error("API მოთხოვნა უარყოფილია:", {
          path,
          status: response.status,
          response: result,
        });

        throw new ApiError(
          getErrorMessage(result, response.status),
          response.status,
        );
      }

      return result?.data ?? result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error.name === "AbortError") {
        throw new ApiError(
          "სერვერის პასუხს ძალიან დიდი დრო დასჭირდა. სცადე თავიდან.",
        );
      }

      throw new ApiError(
        "სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმე ინტერნეტი.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---------- სესია ----------

  function getTokenExpiry(token) {
    try {
      const payload = token.split(".")[1];
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const decoded = JSON.parse(atob(padded));

      return Number.isFinite(decoded.exp) ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // საცავის შეზღუდვამ გვერდის მუშაობა არ უნდა შეწყვიტოს.
    }
  }

  function getSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));

      if (
        !session ||
        typeof session.accessToken !== "string" ||
        !session.accessToken ||
        typeof session.user?.name !== "string" ||
        typeof session.user?.email !== "string" ||
        !session.user.email.trim()
      ) {
        return null;
      }

      const expiresAt = getTokenExpiry(session.accessToken);

      if (expiresAt !== null && Date.now() >= expiresAt) {
        clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  function getCurrentUser() {
    return getSession()?.user ?? null;
  }

  function saveSession(accessToken, profile) {
    if (!profile || typeof profile.email !== "string") {
      throw new ApiError("მომხმარებლის პროფილი ვერ ჩაიტვირთა.");
    }

    const name = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const session = {
      accessToken,
      user: {
        id: profile.id,
        name: name || profile.email,
        email: profile.email,
      },
    };

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      throw new ApiError(
        "სესია ვერ შეინახა. ბრაუზერში დაუშვი საიტის მონაცემების შენახვა.",
      );
    }
  }

  function logout() {
    clearSession();
    window.location.replace("index.html");
  }

  // ---------- ინტერფეისი ----------

  function setMessage(element, text, type = "error") {
    if (!element) return;

    element.textContent = text;
    element.className = `form-message ${type}`;
  }

  function setSubmitting(button, busy, text) {
    if (!button) return;

    button.disabled = busy;
    button.textContent = text;
  }

  function renderAuthNavigation() {
    const authArea = document.getElementById("authArea");
    if (!authArea) return;

    authArea.replaceChildren();

    const user = getCurrentUser();

    if (!user) {
      const link = document.createElement("a");
      link.href = "login.html";
      link.className = "button button-small button-outline";
      link.textContent = "შესვლა";

      authArea.appendChild(link);
      return;
    }

    const account = document.createElement("span");
    account.className = "account-name";
    account.textContent = `გამარჯობა, ${user.name}`;
    account.title = `შესული ხარ: ${user.email}`;

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "button button-small button-outline logout-button";
    logoutButton.textContent = "გასვლა";
    logoutButton.addEventListener("click", logout);

    authArea.append(account, logoutButton);
  }

  function refreshAuthState() {
    renderAuthNavigation();

    if (document.querySelector(".auth-page") && getCurrentUser()) {
      window.location.replace("index.html");
    }
  }

  // თავსებადია არსებულ menu.js, cart.js და orders.js ფაილებთან.
  window.FoodHouseAuth = Object.freeze({
    getCurrentUser,
    getAccessToken: () => getSession()?.accessToken ?? null,
    isLoggedIn: () => Boolean(getCurrentUser()),
    logout,
  });

  // ---------- რეგისტრაცია ----------

  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    const nameInput = document.getElementById("registerName");

    if (nameInput) {
      nameInput.placeholder = "სახელი და გვარი";
    }

    let submitting = false;

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (submitting || !registerForm.reportValidity()) return;

      const fullName = nameInput.value.trim();
      const [firstName, ...lastNameParts] = fullName.split(/\s+/);
      const lastName = lastNameParts.join(" ");

      const email = document
        .getElementById("registerEmail")
        .value.trim()
        .toLowerCase();

      const password = document.getElementById("registerPassword").value;

      const confirmPassword = document.getElementById("confirmPassword").value;

      const message = document.getElementById("registerMessage");
      const button = registerForm.querySelector('button[type="submit"]');

      if (firstName.length < 2 || !lastName) {
        setMessage(message, "შეიყვანე სახელი და გვარი.");
        return;
      }

      if (password.length < 8) {
        setMessage(message, "პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს.");
        return;
      }

      if (password !== confirmPassword) {
        setMessage(message, "პაროლები ერთმანეთს არ ემთხვევა.");
        return;
      }

      submitting = true;
      setMessage(message, "");
      setSubmitting(button, true, "მიმდინარეობს რეგისტრაცია…");

      try {
        await apiRequest("/auth/register", {
          method: "POST",
          body: {
            firstName,
            lastName,
            email,
            password,
          },
        });

        registerForm.reset();
        window.location.replace("login.html?registered=1");
      } catch (error) {
        setMessage(message, error.message);
      } finally {
        submitting = false;
        setSubmitting(button, false, "ანგარიშის შექმნა");
      }
    });
  }

  // ---------- შესვლა ----------

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    const message = document.getElementById("loginMessage");
    const params = new URLSearchParams(window.location.search);

    if (params.get("registered") === "1") {
      setMessage(
        message,
        "ანგარიში შეიქმნა. თუ ელფოსტაზე დადასტურების ინსტრუქცია მიიღე, მიჰყევი მას და შემდეგ შედი.",
        "success",
      );
    }

    let submitting = false;

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (submitting || !loginForm.reportValidity()) return;

      const email = document
        .getElementById("loginEmail")
        .value.trim()
        .toLowerCase();

      const password = document.getElementById("loginPassword").value;

      const button = loginForm.querySelector('button[type="submit"]');

      submitting = true;
      setMessage(message, "");
      setSubmitting(button, true, "მიმდინარეობს შესვლა…");

      try {
        const result = await apiRequest("/auth/login", {
          method: "POST",
          body: { email, password },
        });

        if (typeof result?.accessToken !== "string" || !result.accessToken) {
          throw new ApiError(
            result?.isVerified === false
              ? "შესასვლელად საჭიროა ელფოსტის დადასტურება."
              : "სერვერმა ავტორიზაციის ტოკენი არ დააბრუნა.",
          );
        }

        const profile = await apiRequest("/users/me", {
          token: result.accessToken,
        });

        saveSession(result.accessToken, profile);
        loginForm.reset();

        window.location.replace("index.html");
      } catch (error) {
        setMessage(message, error.message);
      } finally {
        submitting = false;
        setSubmitting(button, false, "შესვლა");
      }
    });
  }
  // ელფოსტის კოდის შეყვანა შესვლის გვერდზე.
  if (loginForm) {
    const section = document.createElement("details");

    const summary = document.createElement("summary");
    summary.textContent = "ელფოსტის დადასტურება";

    const form = document.createElement("form");
    form.className = "auth-form";

    const emailLabel = document.createElement("label");
    emailLabel.textContent = "ელფოსტა";

    const email = document.createElement("input");
    email.type = "email";
    email.required = true;
    email.autocomplete = "email";
    emailLabel.append(email);

    const codeLabel = document.createElement("label");
    codeLabel.textContent = "ელფოსტაზე მიღებული კოდი";

    const code = document.createElement("input");
    code.required = true;
    code.autocomplete = "one-time-code";
    codeLabel.append(code);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "button button-primary";
    submit.textContent = "დადასტურება";

    const status = document.createElement("p");
    status.setAttribute("role", "status");

    form.append(emailLabel, codeLabel, submit, status);
    section.append(summary, form);
    loginForm.after(section);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (submit.disabled || !form.reportValidity()) return;

      submit.disabled = true;
      setMessage(status, "");

      try {
        await apiRequest("/auth/verify-email", {
          method: "PUT",
          body: {
            email: email.value.trim().toLowerCase(),
            code: code.value.trim(),
          },
        });

        document.getElementById("loginEmail").value = email.value.trim();

        form.reset();

        setMessage(
          status,
          "ელფოსტა დადასტურებულია. ახლა შედი ანგარიშში.",
          "success",
        );
      } catch (error) {
        setMessage(status, error.message);
      } finally {
        submit.disabled = false;
      }
    });
  }

  refreshAuthState();
  window.addEventListener("pageshow", refreshAuthState);
})();
