// js/pages.js
(async function () {
  "use strict";

  const api = window.FoodHouseAPI;
  const $ = (id) => document.getElementById(id);

  const money = new Intl.NumberFormat("ka-GE", {
    style: "currency",
    currency: "GEL",
  });

  function node(tag, text, className = "") {
    const el = document.createElement(tag);
    el.textContent = text;
    el.className = className;
    return el;
  }

  function button(text, action) {
    const el = node("button", text, "button button-small button-outline");

    el.type = "button";

    el.addEventListener("click", async () => {
      el.disabled = true;

      try {
        await action();
      } catch (error) {
        const message = $("adminMessage") || $("detailsMessage");
        message.textContent = error.message;
      } finally {
        el.disabled = false;
      }
    });

    return el;
  }

  // ---------- კერძის დეტალები ----------

  if ($("dishDetails")) {
    const target = $("dishDetails");

    try {
      const id = Number(new URLSearchParams(location.search).get("id"));

      if (!Number.isInteger(id) || id < 1) {
        throw new Error("აირჩიე კერძი მენიუდან.");
      }

      const product = await api.request(`/products/${id}`);

      target.replaceChildren(node("h1", product.name));

      if (product.image) {
        const image = document.createElement("img");
        image.alt = product.name;
        image.className = "product-image";

        image.addEventListener(
          "error",
          () => {
            image.hidden = true;
          },
          { once: true },
        );

        image.src = product.image;
        target.append(image);
      }

      target.append(
        node("p", product.description || ""),
        node("strong", money.format(product.price)),
      );

      target.append(
        button("კალათაში დამატება", async () => {
          if (!window.FoodHouseAuth.isLoggedIn()) {
            throw new Error("დამატებამდე გაიარე ავტორიზაცია.");
          }

          await window.FoodHouseCart.addItem(product);
          $("detailsMessage").textContent = "პროდუქტი დაემატა კალათაში.";
        }),
      );
    } catch (error) {
      target.replaceChildren();
      $("detailsMessage").textContent = error.message;
    }
  }

  // ---------- მენიუს მართვა ----------

  const form = $("dishForm");
  if (!form) return;

  const message = $("adminMessage");
  let busy = false;

  function reset() {
    form.reset();

    $("editDishId").value = "";
    $("cancelEditButton").hidden = true;
    $("adminFormTitle").textContent = "ახალი კერძის დამატება";
    $("saveDishButton").textContent = "კერძის დამატება";
  }

  async function renderList() {
    const products = await api.getProducts();

    $("adminDishCount").textContent = String(products.length);
    $("adminDishList").replaceChildren();

    products.forEach((product) => {
      const row = node("article", "", "product-content");

      row.append(
        node("h3", product.name),
        node("p", money.format(product.price)),
      );

      // სტანდარტული პროდუქტების მართვის ღილაკები არ ჩანს.
      if (product.canDelete === true) {
        row.append(
          button("რედაქტირება", async () => {
            if (busy) return;

            const item = await api.request(`/products/${product.id}`);

            if (busy) return;

            $("editDishId").value = item.id;
            $("dishName").value = item.name;
            $("dishDescription").value = item.description || "";
            $("dishPrice").value = item.price;
            $("dishImage").value = item.image || "";
            $("dishCategory").value = String(item.categoryId);

            $("dishVegetarian").checked = Boolean(
              item.vegetarian ?? item.vegeterian,
            );

            $("cancelEditButton").hidden = false;
            $("adminFormTitle").textContent = "კერძის რედაქტირება";
            $("saveDishButton").textContent = "შენახვა";
            $("dishName").focus();
          }),
        );

        row.append(
          button("წაშლა", async () => {
            if (busy || !confirm(`წაიშალოს „${product.name}“?`)) {
              return;
            }

            await api.request(`/products/${product.id}`, {
              method: "DELETE",
            });

            if ($("editDishId").value === String(product.id)) {
              reset();
            }

            message.textContent = "კერძი წაიშალა.";
            await renderList();
          }),
        );
      }

      $("adminDishList").append(row);
    });
  }

  $("cancelEditButton").addEventListener("click", () => {
    if (!busy) reset();
  });

  $("saveDishButton").disabled = true;

  try {
    const categories = await api.getCategories();

    $("dishCategory").replaceChildren();

    categories.forEach((category) => {
      const option = node("option", category.name);
      option.value = category.id;
      $("dishCategory").append(option);
    });

    if (!categories.length) {
      throw new Error("კატეგორიები ვერ მოიძებნა.");
    }

    $("saveDishButton").disabled = false;
    await renderList();
  } catch (error) {
    message.textContent = error.message;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy || !form.reportValidity()) return;

    const id = $("editDishId").value;

    const body = {
      name: $("dishName").value.trim(),
      description: $("dishDescription").value.trim(),
      price: Number($("dishPrice").value),
      image: $("dishImage").value.trim(),
      categoryId: Number($("dishCategory").value),
      vegetarian: $("dishVegetarian").checked,
    };

    if (
      !body.name ||
      !body.description ||
      !Number.isInteger(body.categoryId) ||
      body.categoryId < 1
    ) {
      message.textContent = "სრულად შეავსე კერძის მონაცემები.";
      return;
    }

    if (!id) {
      Object.assign(body, {
        spiciness: 0,
        method: "",
        ingredients: [],
      });
    }

    busy = true;
    $("saveDishButton").disabled = true;
    $("cancelEditButton").disabled = true;

    try {
      await api.request(id ? `/products/${Number(id)}` : "/products", {
        method: id ? "PUT" : "POST",
        body,
      });

      reset();
      message.textContent = "კერძი შენახულია.";

      try {
        await renderList();
      } catch {
        message.textContent +=
          " სიის განახლება ვერ მოხერხდა — განაახლე გვერდი.";
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      busy = false;
      $("saveDishButton").disabled = false;
      $("cancelEditButton").disabled = false;
    }
  });
})();
