// js/data.js
(function () {
  "use strict";

  const API_URL = "https://restaurantapi.stepacademy.ge/api";
  const API_KEY = "dd15cb0c-e956-4f5b-b1c0-d4aaf3ac2053";

  async function request(path, { method = "GET", body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const headers = {
      Accept: "application/json",
      "X-STEP-KEY": API_KEY,
    };

    const token = window.FoodHouseAuth?.getAccessToken?.();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();
      let result;

      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        result = text;
      }

      if (!response.ok) {
        const errors = result?.errors;

        const details =
          errors && typeof errors === "object"
            ? Object.values(errors)
                .flat()
                .filter((value) => typeof value === "string")
                .join(" ")
            : "";

        throw new Error(
          details ||
            result?.message ||
            result?.title ||
            (typeof result === "string" && result.length < 300
              ? result
              : `API შეცდომა (${response.status}).`),
        );
      }

      return result?.data ?? result;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("სერვერის პასუხის დრო ამოიწურა. სცადე თავიდან.");
      }

      if (error instanceof TypeError) {
        throw new Error("სერვერთან კავშირი ვერ დამყარდა.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getProducts(categoryId = "all") {
    const products = new Map();
    const all = categoryId === "all" || categoryId == null;

    if (
      !all &&
      (!Number.isInteger(Number(categoryId)) || Number(categoryId) < 1)
    ) {
      throw new Error("კატეგორია არასწორია.");
    }

    for (let page = 1; ; page++) {
      const query = new URLSearchParams({
        Take: "100",
        Page: String(page),
      });

      if (!all) {
        query.set("CategoryId", String(categoryId));
      }

      const endpoint = all ? "/products" : "/products/filter";
      const data = await request(`${endpoint}?${query}`);

      if (!Array.isArray(data?.products)) {
        throw new Error("პროდუქტების პასუხის ფორმატი არასწორია.");
      }

      const previousSize = products.size;

      for (const product of data.products) {
        if (
          !Number.isInteger(product.id) ||
          typeof product.name !== "string" ||
          !Number.isFinite(product.price) ||
          product.price < 0
        ) {
          throw new Error("პროდუქტის მონაცემები არასწორია.");
        }

        products.set(product.id, {
          ...product,
          description: product.description || "",
          image: product.image || "",
        });
      }

      if (data.hasMore !== true) {
        return [...products.values()];
      }

      if (products.size === previousSize) {
        throw new Error("შემდეგი გვერდი ვერ ჩაიტვირთა.");
      }
    }
  }

  async function getCategories() {
    const data = await request("/categories");

    if (!Array.isArray(data)) {
      throw new Error("კატეგორიების პასუხი არასწორია.");
    }

    return data;
  }

  window.FoodHouseAPI = Object.freeze({
    request,
    getProducts,
    getCategories,
  });
})();
