// js/menu.js
(function () {
  "use strict";

  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const search = document.getElementById("productSearch");
  const select = document.getElementById("categoryFilter");
  const empty = document.getElementById("emptyProducts");
  const count = document.getElementById("resultsCount");
  const message = document.getElementById("menuMessage");

  const money = new Intl.NumberFormat("ka-GE", {
    style: "currency",
    currency: "GEL",
  });

  let products = [];
  let requestId = 0;
  let loaded = false;

  function show(text, error = false) {
    message.className = `menu-message ${error ? "error" : "success"}`;
    message.textContent = text;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function card(product) {
    const article = element("article", "product-card");

    if (product.image) {
      const image = element("img", "product-image");
      image.alt = product.name;
      image.loading = "lazy";

      image.addEventListener(
        "error",
        () => {
          image.hidden = true;
        },
        { once: true },
      );

      image.src = product.image;
      article.append(image);
    }

    const content = element("div", "product-content");
    const title = element("h2", "");

    const link = element("a", "", product.name);
    link.href = `details.html?id=${product.id}`;
    title.append(link);

    const bottom = element("div", "product-bottom");

    const add = element(
      "button",
      "button button-primary button-small",
      "+ დამატება",
    );

    add.type = "button";
    add.setAttribute("aria-label", `${product.name} — დამატება`);

    add.addEventListener("click", async () => {
      if (!window.FoodHouseAuth?.isLoggedIn()) {
        show("პროდუქტის დასამატებლად გაიარე ავტორიზაცია. ", true);

        const login = element("a", "message-login-link", "შესვლა");

        login.href = "login.html";
        message.append(login);
        return;
      }

      add.disabled = true;

      try {
        if (!window.FoodHouseCart) {
          throw new Error("კალათა ვერ ჩაიტვირთა.");
        }

        await window.FoodHouseCart.addItem(product);
        show(`„${product.name}“ დაემატა კალათაში.`);
      } catch (error) {
        show(error.message, true);
      } finally {
        add.disabled = false;
      }
    });

    bottom.append(
      element("span", "product-price", money.format(product.price)),
      add,
    );

    content.append(
      title,
      element("p", "product-description", product.description),
      bottom,
    );

    article.append(content);
    return article;
  }

  function render() {
    if (!loaded) return;

    const query = search.value.trim().toLocaleLowerCase();

    const filtered = products.filter((product) =>
      `${product.name} ${product.description}`
        .toLocaleLowerCase()
        .includes(query),
    );

    grid.replaceChildren(...filtered.map(card));
    count.textContent = `ნაპოვნია ${filtered.length} კერძი`;
    empty.hidden = filtered.length !== 0;
  }

  async function loadProducts() {
    const id = ++requestId;

    loaded = false;
    search.disabled = true;
    empty.hidden = true;

    grid.replaceChildren();
    grid.setAttribute("aria-busy", "true");
    count.textContent = "მენიუ იტვირთება…";
    show("");

    try {
      const result = await window.FoodHouseAPI.getProducts(select.value);

      // ძველმა მოთხოვნამ ახალი ფილტრის შედეგი არ უნდა გადაფაროს.
      if (id !== requestId) return;

      products = result;
      loaded = true;
      render();
    } catch (error) {
      if (id !== requestId) return;

      count.textContent = "მენიუ ვერ ჩაიტვირთა";
      show(error.message, true);

      const retry = element("button", "button button-small", "ხელახლა ცდა");

      retry.type = "button";
      retry.addEventListener("click", loadProducts);
      message.append(retry);
    } finally {
      if (id === requestId) {
        search.disabled = !loaded;
        grid.setAttribute("aria-busy", "false");
      }
    }
  }

  async function loadCategories() {
    select.disabled = true;

    try {
      const categories = await window.FoodHouseAPI.getCategories();

      const all = element("option", "", "ყველა კატეგორია");
      all.value = "all";
      select.replaceChildren(all);

      for (const category of categories) {
        const option = element("option", "", category.name);
        option.value = String(category.id);
        select.append(option);
      }

      select.disabled = false;
    } catch {
      select.options[0].textContent =
        "კატეგორიები ვერ ჩაიტვირთა — განაახლე გვერდი";
    }
  }

  search.addEventListener("input", render);
  select.addEventListener("change", loadProducts);

  loadProducts();
  loadCategories();
})();
