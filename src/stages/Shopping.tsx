import { useId, useMemo } from "react";
import type { Product, ShoppingChallenge } from "../challenge/types";
import { formatDay, formatMoney } from "../lib/format";
import type { ShopAction, ShopSort, ShopState } from "../game/state";
import type { Rejection } from "../game/run";
import { RejectionNote } from "../components/RejectionNote";
import { IconArrowRight, IconBag, IconCheck, IconChevronDown, IconClose, IconMusic, IconSearch, IconTruck } from "../components/Icons";

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

/**
 * SoundMarket. On phones the results are a list (art beside price, rating and delivery, the three things
 * the task compares), the filters fit above the fold, and the cart is a sheet with the order button
 * under the thumb. Wide screens get the classic sidebar and card grid.
 */
export function Shopping({ ch, state, dispatch, onSubmit, rejection }: Props) {
  const products = useMemo(() => visibleProducts(ch, state), [ch, state]);
  const cartItems = state.cart.map((id) => ch.products.find((p) => p.id === id)!);
  const subtotal = cartItems.reduce((s, p) => s + p.priceCents, 0);
  const days = Array.from({ length: 8 }, (_, i) => ch.today + i + 1);
  const filtersActive = !!(state.query || state.maxPrice || state.minRating || state.arriveBy);

  return (
    <div className={`shop ${cartItems.length ? "has-cart" : ""}`}>
      <header className="sm-top">
        <div className="sm-brand">
          <span className="sm-logo" aria-hidden>
            <IconMusic size={16} strokeWidth={2.4} />
          </span>
          SoundMarket
        </div>
        <div className="sm-today">
          <IconTruck size={15} />
          Today: {formatDay(ch.today)}
        </div>
        <button
          className="sm-cart"
          data-trace="shop:cart"
          aria-label={`Cart, ${state.cart.length} item${state.cart.length === 1 ? "" : "s"}`}
          onClick={() => dispatch({ type: "cart", open: !state.cartOpen })}
        >
          <IconBag size={20} />
          <span className="sm-cart-word">Cart</span>
          <span className={`sm-cart-count ${state.cart.length ? "full" : ""}`} key={state.cart.length}>
            {state.cart.length}
          </span>
        </button>
        <label className="sm-search">
          <IconSearch size={18} />
          <input
            data-trace="shop:search"
            type="search"
            placeholder="Search headphones"
            enterKeyHint="search"
            value={state.query}
            onChange={(e) => dispatch({ type: "query", value: e.target.value })}
          />
        </label>
      </header>

      <div className="sm-body">
        <aside className="sm-filters" aria-label="Filters">
          <div className="sm-filter sm-f-price">
            <div className="sm-filter-label">Max price</div>
            <label className="sm-field sm-price">
              <span aria-hidden>$</span>
              <input
                data-trace="shop:maxprice"
                inputMode="decimal"
                enterKeyHint="done"
                aria-label="Max price in dollars"
                placeholder="Any"
                value={state.maxPrice}
                onChange={(e) => dispatch({ type: "maxPrice", value: e.target.value })}
              />
            </label>
          </div>
          <div className="sm-filter sm-f-arrive">
            <div className="sm-filter-label">Arrives by</div>
            <div className="sm-field sm-select">
              <select
                data-trace="shop:arriveby"
                aria-label="Arrives by"
                value={state.arriveBy}
                onChange={(e) => dispatch({ type: "arriveBy", value: Number(e.target.value) })}
              >
                <option value={0}>Any day</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {formatDay(d)}
                  </option>
                ))}
              </select>
              <IconChevronDown size={16} />
            </div>
          </div>
          <div className="sm-filter sm-f-rating">
            <div className="sm-filter-label">Customer rating</div>
            <div className="sm-chips">
              {RATING_CHIPS.map((r) => (
                <button
                  key={r}
                  data-trace={`shop:rating:${r}`}
                  className={`sm-chip ${state.minRating === r ? "on" : ""}`}
                  aria-pressed={state.minRating === r}
                  onClick={() => dispatch({ type: "minRating", value: r })}
                >
                  {r ? `${r.toFixed(1)}★ & up` : "Any"}
                </button>
              ))}
            </div>
          </div>
          {filtersActive && (
            <button className="sm-clear" data-trace="shop:clear" onClick={() => dispatch({ type: "clearFilters" })}>
              Clear filters
            </button>
          )}
        </aside>

        <section className="sm-results">
          <div className="sm-results-bar">
            <span className="sm-count">
              {products.length} result{products.length === 1 ? "" : "s"}
            </span>
            <label className="sm-sort">
              <span>Sort by</span>
              <span className="sm-field sm-select">
                <select data-trace="shop:sort" value={state.sort} onChange={(e) => dispatch({ type: "sort", value: e.target.value as ShopSort })}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <IconChevronDown size={16} />
              </span>
            </label>
          </div>
          <div className="sm-grid">
            {products.map((p) => {
              const inCart = state.cart.includes(p.id);
              return (
                <article className={`sm-card ${inCart ? "in-cart" : ""}`} key={p.id} data-trace={`shop:card:${p.id}`}>
                  <div className="sm-art">
                    {p.badge && <span className={`sm-badge b-${p.badge.replace(/\s/g, "").toLowerCase()}`}>{p.badge}</span>}
                    <HeadphoneArt hue={p.hue} style={p.style} />
                  </div>
                  <div className="sm-info">
                    <div className="sm-name">
                      {p.brand} {p.model}
                    </div>
                    <div className="sm-style">{p.style} headphones</div>
                    <Stars rating={p.rating} reviews={p.reviews} />
                    <div className="sm-cost">
                      <strong>{formatMoney(p.priceCents)}</strong>
                      {p.listPriceCents && <s>{formatMoney(p.listPriceCents)}</s>}
                    </div>
                    <div className="sm-delivery">
                      <IconTruck size={14} />
                      <span>
                        Delivery <b>{formatDay(p.deliveryDay)}</b>
                      </span>
                    </div>
                  </div>
                  <button className={`sm-add ${inCart ? "in-cart" : ""}`} data-trace={`shop:add:${p.id}`} onClick={() => dispatch({ type: "add", id: p.id })}>
                    {inCart ? (
                      <>
                        <IconCheck size={16} strokeWidth={2.6} /> In cart
                      </>
                    ) : (
                      "Add to cart"
                    )}
                  </button>
                </article>
              );
            })}
            {!products.length && (
              <div className="sm-empty">
                <b>No headphones match these filters.</b>
                {filtersActive && (
                  <button className="sm-clear" onClick={() => dispatch({ type: "clearFilters" })}>
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Small screens: the cart stays one tap away once there's something in it. */}
      {cartItems.length > 0 && !state.cartOpen && (
        <button className="sm-cartbar dock" data-trace="shop:cartbar" onClick={() => dispatch({ type: "cart", open: true })}>
          <span className="sm-cartbar-n">
            <IconBag size={18} />
            {cartItems.length}
          </span>
          <span className="sm-cartbar-label">View cart</span>
          <strong>{formatMoney(subtotal)}</strong>
          <IconArrowRight size={18} />
        </button>
      )}

      {state.cartOpen && (
        <div className="sm-scrim" onClick={() => dispatch({ type: "cart", open: false })}>
          <aside className="sm-drawer" role="dialog" aria-label="Your cart" onClick={(e) => e.stopPropagation()} data-trace="shop:drawer">
            <span className="sm-grip" aria-hidden />
            <div className="sm-drawer-head">
              <h3>Your cart</h3>
              <button className="sm-icon-btn" data-trace="shop:cart-close" aria-label="Close cart" onClick={() => dispatch({ type: "cart", open: false })}>
                <IconClose size={20} />
              </button>
            </div>
            <div className="sm-lines">
              {cartItems.length === 0 && <p className="sm-muted sm-empty-cart">Your cart is empty.</p>}
              {cartItems.map((p) => (
                <div className="sm-line" key={p.id}>
                  <HeadphoneArt hue={p.hue} style={p.style} small />
                  <div className="sm-line-main">
                    <div className="sm-name">
                      {p.brand} {p.model}
                    </div>
                    <div className="sm-muted sm-small">
                      {p.rating.toFixed(1)}★ · Delivery {formatDay(p.deliveryDay)}
                    </div>
                    <button className="sm-remove" data-trace={`shop:remove:${p.id}`} onClick={() => dispatch({ type: "remove", id: p.id })}>
                      Remove
                    </button>
                  </div>
                  <div className="sm-line-price">{formatMoney(p.priceCents)}</div>
                </div>
              ))}
            </div>
            <div className="sm-drawer-foot">
              <div className="sm-total">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              {rejection && <RejectionNote rejection={rejection} />}
              <button className="sm-order" data-trace="shop:order" onClick={onSubmit}>
                Place order
              </button>
              <p className="sm-muted sm-small sm-center">Simulated store — no real purchase is made.</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Stars({ rating, reviews }: { rating: number; reviews: number }) {
  const pct = (rating / 5) * 100;
  return (
    <div className="sm-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span className="sm-stars-track" aria-hidden>
        ★★★★★
        <span className="sm-stars-fill" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      <b>{rating.toFixed(1)}</b>
      <span className="sm-muted">({reviews.toLocaleString("en-US")})</span>
    </div>
  );
}

export function HeadphoneArt({ hue, style, small }: { hue: number; style: Product["style"]; small?: boolean }) {
  const bg = useId();
  const main = `hsl(${hue} 58% 54%)`;
  const dark = `hsl(${hue} 45% 26%)`;
  const light = `hsl(${hue} 75% 92%)`;
  const lighter = `hsl(${hue} 80% 96%)`;
  const shine = "rgba(255,255,255,0.45)";
  const inEar = style === "In-ear" || style === "Open-ear";
  const cupY = style === "On-ear" ? 48 : 44;
  const cupH = style === "On-ear" ? 24 : 32;
  return (
    <svg className={small ? "art art-small" : "art"} viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={bg} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor={lighter} />
          <stop offset="1" stopColor={light} />
        </radialGradient>
      </defs>
      <rect width="120" height="90" fill={`url("#${bg}")`} />
      <ellipse cx="60" cy="80" rx="34" ry="4" fill={dark} opacity="0.12" />
      {inEar ? (
        <g>
          <ellipse cx="45" cy="50" rx="14" ry="17" fill={main} />
          <ellipse cx="45" cy="50" rx="6" ry="8" fill={dark} />
          <ellipse cx="40" cy="42" rx="4" ry="5" fill={shine} />
          <ellipse cx="77" cy="44" rx="14" ry="17" fill={main} />
          <ellipse cx="77" cy="44" rx="6" ry="8" fill={dark} />
          <ellipse cx="72" cy="36" rx="4" ry="5" fill={shine} />
          {style === "Open-ear" && <path d="M36 36 q9 -16 20 -2 M68 30 q9 -16 20 -2" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />}
        </g>
      ) : (
        <g>
          <path d="M30 56 V44 a30 30 0 0 1 60 0 V56" fill="none" stroke={dark} strokeWidth="7" strokeLinecap="round" />
          <rect x="20" y={cupY} width="20" height={cupH} rx="9" fill={main} />
          <rect x="80" y={cupY} width="20" height={cupH} rx="9" fill={main} />
          <rect x="24" y={cupY + 4} width="5" height={cupH - 12} rx="2.5" fill={shine} />
          <rect x="84" y={cupY + 4} width="5" height={cupH - 12} rx="2.5" fill={shine} />
        </g>
      )}
    </svg>
  );
}
