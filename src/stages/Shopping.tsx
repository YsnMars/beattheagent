import { useMemo } from "react";
import type { Product, ShoppingChallenge } from "../challenge/types";
import { formatDay, formatMoney } from "../lib/format";
import type { ShopAction, ShopSort, ShopState } from "../game/state";
import type { Rejection } from "../game/run";
import { RejectionNote } from "../components/RejectionNote";

type Props = {
  ch: ShoppingChallenge;
  state: ShopState;
  dispatch: (a: ShopAction) => void;
  onSubmit: () => void;
  /** The latest rejection, while it still describes the current answer. */
  rejection: Rejection | null;
};

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Customer rating" },
  { value: "delivery", label: "Fastest delivery" },
];

const RATING_CHIPS = [0, 4.0, 4.2, 4.3, 4.4, 4.5];

export function visibleProducts(ch: ShoppingChallenge, s: ShopState): Product[] {
  const q = s.query.trim().toLowerCase();
  const max = s.maxPrice ? Math.round(parseFloat(s.maxPrice) * 100) : NaN;
  const list = ch.products.filter(
    (p) =>
      (!q || `${p.brand} ${p.model} ${p.style}`.toLowerCase().includes(q)) &&
      (Number.isNaN(max) || p.priceCents <= max) &&
      (!s.minRating || p.rating >= s.minRating) &&
      (!s.arriveBy || p.deliveryDay <= s.arriveBy),
  );
  const cmp: Record<ShopSort, (a: Product, b: Product) => number> = {
    featured: () => 0,
    "price-asc": (a, b) => a.priceCents - b.priceCents,
    "price-desc": (a, b) => b.priceCents - a.priceCents,
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    delivery: (a, b) => a.deliveryDay - b.deliveryDay,
  };
  return list.map((p, i) => ({ p, i })).sort((x, y) => cmp[s.sort](x.p, y.p) || x.i - y.i).map((x) => x.p);
}

export function Shopping({ ch, state, dispatch, onSubmit, rejection }: Props) {
  const products = useMemo(() => visibleProducts(ch, state), [ch, state]);
  const cartItems = state.cart.map((id) => ch.products.find((p) => p.id === id)!);
  const subtotal = cartItems.reduce((s, p) => s + p.priceCents, 0);
  const days = Array.from({ length: 8 }, (_, i) => ch.today + i + 1);
  const filtersActive = !!(state.query || state.maxPrice || state.minRating || state.arriveBy);

  return (
    <div className="shop">
      <div className="shop-top">
        <div className="shop-logo">
          <span className="shop-logo-mark">♪</span> SoundMarket
        </div>
        <label className="shop-search">
          <span aria-hidden>⌕</span>
          <input
            data-trace="shop:search"
            type="search"
            placeholder="Search headphones"
            value={state.query}
            onChange={(e) => dispatch({ type: "query", value: e.target.value })}
          />
        </label>
        <div className="shop-today">Today: {formatDay(ch.today)}</div>
        <button className="shop-cart-btn" data-trace="shop:cart" onClick={() => dispatch({ type: "cart", open: !state.cartOpen })}>
          Cart <span className="shop-cart-count">{state.cart.length}</span>
        </button>
      </div>

      <div className="shop-body">
        <aside className="shop-filters">
          <div className="shop-filter">
            <div className="shop-filter-label">Max price</div>
            <label className="shop-price">
              <span>$</span>
              <input
                data-trace="shop:maxprice"
                inputMode="decimal"
                placeholder="Any"
                value={state.maxPrice}
                onChange={(e) => dispatch({ type: "maxPrice", value: e.target.value })}
              />
            </label>
          </div>
          <div className="shop-filter">
            <div className="shop-filter-label">Customer rating</div>
            <div className="chips">
              {RATING_CHIPS.map((r) => (
                <button
                  key={r}
                  data-trace={`shop:rating:${r}`}
                  className={`chip ${state.minRating === r ? "on" : ""}`}
                  onClick={() => dispatch({ type: "minRating", value: r })}
                >
                  {r ? `${r.toFixed(1)}★ & up` : "Any"}
                </button>
              ))}
            </div>
          </div>
          <div className="shop-filter">
            <div className="shop-filter-label">Arrives by</div>
            <select data-trace="shop:arriveby" value={state.arriveBy} onChange={(e) => dispatch({ type: "arriveBy", value: Number(e.target.value) })}>
              <option value={0}>Any day</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDay(d)}
                </option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <button className="link-btn" data-trace="shop:clear" onClick={() => dispatch({ type: "clearFilters" })}>
              Clear filters
            </button>
          )}
        </aside>

        <section className="shop-results">
          <div className="shop-results-bar">
            <span>
              {products.length} result{products.length === 1 ? "" : "s"}
            </span>
            <label className="shop-sort">
              Sort by
              <select data-trace="shop:sort" value={state.sort} onChange={(e) => dispatch({ type: "sort", value: e.target.value as ShopSort })}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="shop-grid">
            {products.map((p) => (
              <article className="product" key={p.id} data-trace={`shop:card:${p.id}`}>
                {p.badge && <span className={`product-badge b-${p.badge.replace(/\s/g, "").toLowerCase()}`}>{p.badge}</span>}
                <HeadphoneArt hue={p.hue} style={p.style} />
                <div className="product-name">
                  {p.brand} {p.model}
                </div>
                <div className="product-style">{p.style} headphones</div>
                <Stars rating={p.rating} reviews={p.reviews} />
                <div className="product-price">
                  <strong>{formatMoney(p.priceCents)}</strong>
                  {p.listPriceCents && <s>{formatMoney(p.listPriceCents)}</s>}
                </div>
                <div className="product-delivery">
                  Delivery <b>{formatDay(p.deliveryDay)}</b>
                </div>
                <button
                  className={`btn-shop ${state.cart.includes(p.id) ? "in-cart" : ""}`}
                  data-trace={`shop:add:${p.id}`}
                  onClick={() => dispatch({ type: "add", id: p.id })}
                >
                  {state.cart.includes(p.id) ? "In cart ✓" : "Add to cart"}
                </button>
              </article>
            ))}
            {!products.length && <div className="empty">No headphones match these filters.</div>}
          </div>
        </section>
      </div>

      {state.cartOpen && (
        <div className="drawer-scrim" onClick={() => dispatch({ type: "cart", open: false })}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} data-trace="shop:drawer">
            <div className="drawer-head">
              <h3>Your cart</h3>
              <button className="icon-btn" data-trace="shop:cart-close" aria-label="Close cart" onClick={() => dispatch({ type: "cart", open: false })}>
                ✕
              </button>
            </div>
            {cartItems.length === 0 && <p className="muted">Your cart is empty.</p>}
            {cartItems.map((p) => (
              <div className="cart-line" key={p.id}>
                <HeadphoneArt hue={p.hue} style={p.style} small />
                <div className="cart-line-main">
                  <div className="product-name">
                    {p.brand} {p.model}
                  </div>
                  <div className="muted small">
                    {p.rating.toFixed(1)}★ · Delivery {formatDay(p.deliveryDay)}
                  </div>
                </div>
                <div className="cart-line-price">{formatMoney(p.priceCents)}</div>
                <button className="link-btn" data-trace={`shop:remove:${p.id}`} onClick={() => dispatch({ type: "remove", id: p.id })}>
                  Remove
                </button>
              </div>
            ))}
            <div className="drawer-total">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            {rejection && <RejectionNote rejection={rejection} />}
            <button className="btn-shop btn-order" data-trace="shop:order" onClick={onSubmit}>
              Place order
            </button>
            <p className="muted small center">Simulated store — no real purchase is made.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Stars({ rating, reviews }: { rating: number; reviews: number }) {
  const pct = (rating / 5) * 100;
  return (
    <div className="stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span className="stars-track">
        ★★★★★
        <span className="stars-fill" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      <b>{rating.toFixed(1)}</b>
      <span className="muted">({reviews.toLocaleString("en-US")})</span>
    </div>
  );
}

export function HeadphoneArt({ hue, style, small }: { hue: number; style: Product["style"]; small?: boolean }) {
  const main = `hsl(${hue} 55% 52%)`;
  const dark = `hsl(${hue} 45% 26%)`;
  const light = `hsl(${hue} 70% 88%)`;
  const inEar = style === "In-ear" || style === "Open-ear";
  return (
    <svg className={small ? "art art-small" : "art"} viewBox="0 0 120 90" aria-hidden>
      <rect width="120" height="90" rx="12" fill={light} />
      {inEar ? (
        <g>
          <ellipse cx="45" cy="50" rx="14" ry="17" fill={main} />
          <ellipse cx="45" cy="50" rx="6" ry="8" fill={dark} />
          <ellipse cx="77" cy="44" rx="14" ry="17" fill={main} />
          <ellipse cx="77" cy="44" rx="6" ry="8" fill={dark} />
          {style === "Open-ear" && <path d="M36 36 q9 -16 20 -2 M68 30 q9 -16 20 -2" stroke={dark} strokeWidth="4" fill="none" />}
        </g>
      ) : (
        <g>
          <path d="M30 56 V44 a30 30 0 0 1 60 0 V56" fill="none" stroke={dark} strokeWidth="7" strokeLinecap="round" />
          <rect x="20" y={style === "On-ear" ? 48 : 44} width="20" height={style === "On-ear" ? 24 : 32} rx="9" fill={main} />
          <rect x="80" y={style === "On-ear" ? 48 : 44} width="20" height={style === "On-ear" ? 24 : 32} rx="9" fill={main} />
        </g>
      )}
    </svg>
  );
}
