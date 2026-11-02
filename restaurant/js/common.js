// js/common.js

(function () {
  "use strict";

  const currentYear = document.getElementById("currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("navMenu");

  if (!toggle || !menu) return;

  const mobileScreen = window.matchMedia("(max-width: 1100px)");

  function setMenuState(isOpen, restoreFocus = false) {
    const shouldOpen = mobileScreen.matches && isOpen;

    menu.classList.toggle("open", shouldOpen);

    toggle.setAttribute("aria-expanded", String(shouldOpen));

    toggle.setAttribute(
      "aria-label",
      shouldOpen ? "მენიუს დახურვა" : "მენიუს გახსნა",
    );

    if (restoreFocus && mobileScreen.matches) {
      toggle.focus();
    }
  }

  toggle.addEventListener("click", function () {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    setMenuState(!isOpen);
  });

  // მუშაობს მოგვიანებით დამატებულ ღილაკებზეც, მაგალითად „გასვლაზე“.
  menu.addEventListener("click", function (event) {
    if (event.target.closest("a, button")) {
      setMenuState(false);
    }
  });

  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && menu.classList.contains("open")) {
      setMenuState(false, true);
    }
  });

  // კლავიატურით მენიუს გარეთ გადასვლისას დახურვა.
  document.addEventListener("focusin", function (event) {
    if (
      menu.classList.contains("open") &&
      !menu.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      setMenuState(false);
    }
  });

  mobileScreen.addEventListener("change", function () {
    const focusedElement = document.activeElement;
    const focusWasInMenu = menu.contains(focusedElement);
    const focusWasOnToggle = focusedElement === toggle;

    setMenuState(false);

    if (mobileScreen.matches && focusWasInMenu) {
      toggle.focus();
    } else if (!mobileScreen.matches && focusWasOnToggle) {
      const firstLink = menu.querySelector("a");

      if (firstLink) firstLink.focus();
    }
  });

  window.addEventListener("pageshow", function () {
    setMenuState(false);
  });

  setMenuState(false);
})();
