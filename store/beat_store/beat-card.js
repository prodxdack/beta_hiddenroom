export function beatCardMarkup({
  id,
  title,
  producerMarkup,
  coverMarkup,
  metaMarkup,
  optionsMarkup = "",
  priceLabel = "Precio por confirmar",
  canBuy = true,
}) {
  return `
    <article class="product-card beat-card" data-item-id="${id}">
      ${optionsMarkup}
      ${coverMarkup}
      <div class="beat-card__body">
        <div class="beat-card__info">
          <h3>${title}</h3>
          <p class="beat-card__producer">${producerMarkup}</p>
        </div>
        <div class="beat-card__commercial-row">
          <p class="beat-card__price">${priceLabel}</p>
          <div class="beat-card__actions">
            <button class="primary-button" type="button" data-add-beat="${id}" ${canBuy ? "" : "disabled"} aria-expanded="false">Ver licencias</button>
          </div>
        </div>
        <div class="beat-card__meta-slot">${metaMarkup}</div>
      </div>
    </article>`;
}
