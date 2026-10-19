export function beatCardMarkup({
  id,
  title,
  slug = "",
  producerMarkup,
  coverMarkup,
  metaMarkup,
  optionsMarkup = "",
  priceLabel = "Aún no disponible",
  canBuy = true,
  actionMarkup = "",
}) {
  const titleMarkup = slug ? `<a class="beat-card__title-link" href="product.html?slug=${encodeURIComponent(String(slug))}">${title}</a>` : title;
  const defaultActionMarkup = `<button class="primary-button" type="button" data-add-beat="${id}" ${canBuy ? "" : "disabled"} aria-expanded="false">Ver licencias</button>`;
  return `
    <article class="product-card beat-card" data-item-id="${id}">
      ${optionsMarkup}
      ${coverMarkup}
      <div class="beat-card__body">
        <div class="beat-card__info">
          <h3>${titleMarkup}</h3>
          <p class="beat-card__producer">${producerMarkup}</p>
        </div>
        <div class="beat-card__commercial-row">
          <p class="beat-card__price">${priceLabel}</p>
          <div class="beat-card__actions">
            ${actionMarkup || defaultActionMarkup}
          </div>
        </div>
        <div class="beat-card__meta-slot">${metaMarkup}</div>
      </div>
    </article>`;
}
