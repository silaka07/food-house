// js/orders.js

(function () {
  "use strict";

  const ordersList = document.getElementById("ordersList");
  const ordersLayout = document.getElementById("ordersLayout");
  const emptyOrders = document.getElementById("emptyOrders");
  const loginRequired = document.getElementById("loginRequired");

  const summaryQuantity = document.getElementById("summaryQuantity");
  const summaryTotal = document.getElementById("summaryTotal");
  const message = document.getElementById("ordersMessage");

  if (!ordersList) return;

  const cart = window.FoodHouseCart;
  const auth = window.FoodHouseAuth;

  const money = new Intl.NumberFormat("ka-GE", {
    style: "currency",
    currency: "GEL",
  });

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = `form-message ${type}`;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function restoreButtonFocus(productId, action) {
    const card = Array.from(ordersList.children).find(
      (element) => element.dataset.productId === String(productId),
    );

    if (!card) return;

    let button = card.querySelector(`[data-action="${action}"]`);

    // რაოდენობა 1-ზე რომ ჩამოვა, მინუსი ითიშება.
    if (button && button.disabled) {
      button = card.querySelector('[data-action="increase"]');
    }

    if (button) button.focus();
  }

  function changeQuantity(item, change) {
    if (!auth.isLoggedIn()) {
      renderOrders();
      return;
    }

    const nextQuantity = item.quantity + change;

    if (nextQuantity < 1) return;

    try {
      cart.updateQuantity(item.id, nextQuantity);

      showMessage(`„${item.name}“ — რაოდენობა განახლდა.`);

      restoreButtonFocus(item.id, change > 0 ? "increase" : "decrease");
    } catch {
      showMessage("რაოდენობა ვერ განახლდა. სცადე თავიდან.", "error");
    }
  }

  function deleteProduct(item) {
    if (!auth.isLoggedIn()) {
      renderOrders();
      return;
    }

    try {
      cart.removeItem(item.id);

      showMessage(`„${item.name}“ წაიშალა.`);

      // წაშლის შემდეგ ფოკუსი შემდეგ მოქმედებაზე გადადის.
      const nextButton = ordersList.querySelector("button");

      if (nextButton) {
        nextButton.focus();
      } else {
        emptyOrders.querySelector("a").focus();
      }
    } catch {
      showMessage("პროდუქტი ვერ წაიშალა. სცადე თავიდან.", "error");
    }
  }

  function createOrderCard(item) {
    const card = createElement("article", "order-card");
    card.dataset.productId = String(item.id);

    const image = createElement("img", "order-image");
    if (item.image) {
      image.src = item.image;
    } else {
      image.hidden = true;
    }

    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
      },
      { once: true },
    );
    image.alt = item.name;
    image.loading = "lazy";
    image.width = 120;
    image.height = 120;

    const info = createElement("div", "order-info");

    const title = createElement("h2", "", item.name);

    const unitPrice = createElement(
      "p",
      "order-unit-price",
      `ერთეულის ფასი: ${money.format(item.price)}`,
    );

    const quantityControls = createElement("div", "quantity-controls");

    quantityControls.setAttribute("role", "group");
    quantityControls.setAttribute("aria-label", `${item.name} — რაოდენობა`);

    const decreaseButton = createElement("button", "quantity-button", "−");

    decreaseButton.type = "button";
    decreaseButton.dataset.action = "decrease";
    decreaseButton.disabled = item.quantity <= 1;

    decreaseButton.setAttribute(
      "aria-label",
      `${item.name} — რაოდენობის შემცირება`,
    );

    decreaseButton.addEventListener("click", function () {
      changeQuantity(item, -1);
    });

    const quantity = createElement(
      "span",
      "quantity-value",
      String(item.quantity),
    );

    const increaseButton = createElement("button", "quantity-button", "+");

    increaseButton.type = "button";
    increaseButton.dataset.action = "increase";

    increaseButton.setAttribute(
      "aria-label",
      `${item.name} — რაოდენობის გაზრდა`,
    );

    increaseButton.addEventListener("click", function () {
      changeQuantity(item, 1);
    });

    quantityControls.append(decreaseButton, quantity, increaseButton);

    info.append(title, unitPrice, quantityControls);

    const actions = createElement("div", "order-actions");

    const lineTotal = createElement(
      "strong",
      "order-line-total",
      money.format((Math.round(item.price * 100) * item.quantity) / 100),
    );

    const removeButton = createElement(
      "button",
      "remove-order-button",
      "წაშლა",
    );

    removeButton.type = "button";

    removeButton.setAttribute("aria-label", `${item.name} — შეკვეთიდან წაშლა`);

    removeButton.addEventListener("click", function () {
      deleteProduct(item);
    });

    actions.append(lineTotal, removeButton);
    card.append(image, info, actions);

    return card;
  }

  function renderOrders() {
    ordersList.replaceChildren();

    ordersLayout.hidden = true;
    emptyOrders.hidden = true;
    loginRequired.hidden = true;

    showMessage("");
    cart.updateBadge();

    if (!auth.isLoggedIn()) {
      loginRequired.hidden = false;
      return;
    }

    let items;

    try {
      items = cart.getItems();
    } catch {
      showMessage("შეკვეთები ვერ ჩაიტვირთა. სცადე გვერდის განახლება.", "error");
      return;
    }

    if (items.length === 0) {
      emptyOrders.hidden = false;
      return;
    }

    let totalQuantity = 0;
    let totalCents = 0;

    items.forEach((item) => {
      ordersList.appendChild(createOrderCard(item));

      totalQuantity += item.quantity;
      totalCents += Math.round(item.price * 100) * item.quantity;
    });

    summaryQuantity.textContent = String(totalQuantity);
    summaryTotal.textContent = money.format(totalCents / 100);

    ordersLayout.hidden = false;
  }

  // cart.js ამ მოვლენას ცვლილების შემდეგ აგზავნის.
  window.addEventListener("cart:updated", renderOrders);

  // ბრაუზერის Back ღილაკით დაბრუნებისას განახლება.
  window.addEventListener("pageshow", renderOrders);

  renderOrders();
})();
