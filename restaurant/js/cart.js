// js/cart.js

(function () {
  "use strict";

  function getStorageKey() {
    const user = window.FoodHouseAuth.getCurrentUser();

    if (!user) return null;

    return `foodHouseCart:${user.email.toLowerCase()}`;
  }

  function getItems() {
    const key = getStorageKey();

    if (!key) return [];

    const saved = localStorage.getItem(key);

    if (!saved) return [];

    const items = JSON.parse(saved);

    if (
      !Array.isArray(items) ||
      !items.every(
        (item) =>
          item &&
          Number.isFinite(item.id) &&
          typeof item.name === "string" &&
          Number.isFinite(item.price) &&
          item.price >= 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      )
    ) {
      throw new Error("შეკვეთების მონაცემები ვერ წაიკითხა.");
    }

    return items;
  }

  function saveItems(items) {
    const key = getStorageKey();

    if (!key) {
      throw new Error("გაიარე ავტორიზაცია.");
    }

    localStorage.setItem(key, JSON.stringify(items));

    updateBadge();

    window.dispatchEvent(new Event("cart:updated"));
  }

  function addItem(product) {
    if (!getStorageKey()) {
      throw new Error("გაიარე ავტორიზაცია.");
    }

    const items = getItems();

    const existing = items.find((item) => item.id === product.id);

    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      });
    }

    saveItems(items);
  }

  function updateQuantity(productId, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) return;

    const items = getItems();
    const item = items.find((product) => product.id === productId);

    if (!item) return;

    item.quantity = quantity;

    saveItems(items);
  }

  function removeItem(productId) {
    const items = getItems().filter((item) => item.id !== productId);

    saveItems(items);
  }

  function updateBadge() {
    let count = 0;

    try {
      count = getItems().reduce((total, item) => total + item.quantity, 0);
    } catch {
      count = 0;
    }

    document.querySelectorAll(".orders-badge").forEach((badge) => {
      badge.textContent = count > 0 ? String(count) : "";
      badge.hidden = count === 0;

      badge.setAttribute(
        "aria-label",
        `არჩეული პროდუქტების რაოდენობა: ${count}`,
      );
    });
  }

  window.FoodHouseCart = {
    getItems,
    addItem,
    updateQuantity,
    removeItem,
    updateBadge,
  };

  updateBadge();

  window.addEventListener("pageshow", updateBadge);

  // სხვა ჩანართში შეცვლილი შეკვეთების ასახვა.
  window.addEventListener("storage", function (event) {
    if (event.key === null || event.key === getStorageKey()) {
      updateBadge();
      window.dispatchEvent(new Event("cart:updated"));
    }
  });
})();
