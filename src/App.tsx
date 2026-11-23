import { colorHex } from './colors';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { store } from './store.config';
import type { Catalog, CartItem, Product } from './types';
import { lineKey, MAX_QUANTITY, money, normalizeCart, subtotal, whatsappLink } from './cart';
import { Dialog, Icon, ProductImage } from './components';

const needsInquiry = (product: Product) => product.sizes.length === 0;
const productPrice = (product: Product) => needsInquiry(product) ? 'Consultar precio' : money(product.price);
const inquiryUrl = (product: Product) => `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`¡Hola, ${store.name}! Quiero consultar precio, tallas y disponibilidad de ${product.name}. Código: ${product.id}`)}`;

const storageKey = `${store.id}:cart:v1`;
const normalizeText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function readCart(): unknown { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { return []; } }

function ProductDetail({ product, onAdd }: { product: Product; onAdd: (p: Product, size: string) => void }) {
  const [size, setSize] = useState(product.sizes[0] ?? '');
  return <div className="product-detail"><div className="detail-image"><ProductImage src={product.image} alt={`Imagen de ${product.name}`} /></div><div className="detail-copy">
    <span className="eyebrow">DESCUBRE TU PRÓXIMO FAVORITO</span><h2>{product.name}</h2><p className="detail-price">{productPrice(product)}</p><p>{product.description}</p><p className="selected-color"><span className="swatch" style={{background:colorHex(product.color)}}/><strong>Color:</strong> {product.color || 'Por confirmar'}</p>
    {!needsInquiry(product) && <fieldset className="size-picker"><legend>Elige una talla</legend>{product.sizes.map(s => <button key={s} className={s === size ? 'selected' : ''} aria-pressed={s === size} onClick={() => setSize(s)}>{s}</button>)}</fieldset>}
    <>{needsInquiry(product) ? <a className="button primary full" href={inquiryUrl(product)} target="_blank" rel="noopener noreferrer"><Icon name="chat"/>Consultar precio y tallas</a> : <button className="button primary full" disabled={!product.available || !size} onClick={() => onAdd(product, size)}><Icon name="bag" />{product.available ? 'Agregar a mi bolsa' : 'No disponible'}</button>}</>
    <p className="small muted">La disponibilidad y la entrega se confirman por WhatsApp.</p>
    {product.demo && <p className="demo-inline">Producto, imagen y precio de demostración.</p>}
  </div></div>;
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [bag, setBag] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [storageWarning, setStorageWarning] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    const loadCatalog = async () => {
      try {
        const response = await fetch('/api/admin?action=public', { signal: controller.signal });
        if (!response.ok) throw new Error('API no disponible');
        const data = await response.json();
        if (!data.demo && Array.isArray(data.products) && Array.isArray(data.categories)) return data as Catalog;
      } catch (e) {
        if (controller.signal.aborted) throw e;
      }
      const response = await fetch('/catalog.json', { signal: controller.signal });
      if (!response.ok) throw new Error('No se pudo cargar el catálogo');
      const data = await response.json();
      if (!Array.isArray(data.products) || !Array.isArray(data.categories)) throw new Error('Catálogo inválido');
      return data as Catalog;
    };
    loadCatalog().then(data => {
      setCatalog(data);
      setCart(normalizeCart(readCart(), data.products));
    }).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { if (catalog) { try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch { setStorageWarning(true); } } }, [cart, catalog]);
  useEffect(() => { if (announcement) { const timer = window.setTimeout(() => setAnnouncement(''), 3500); return () => clearTimeout(timer); } }, [announcement]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);

  const products = catalog?.products ?? [];
  const categories = catalog?.categories ?? [];
  const filtered = products.filter(p => p.visible && (category === 'all' || p.categoryId === category) && normalizeText(`${p.name} ${p.description} ${p.color}`).includes(normalizeText(search))).sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const orderUrl = whatsappLink(store.whatsapp, store.name, cart, products, store.demo);
  const contactUrl = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`¡Hola, ${store.name}! Me gustaría conocer más sobre su ropa urbana.`)}`;
  const chooseCategory = (id: string) => { setCategory(id); setMenu(false); document.getElementById('catalogo')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); };
  const add = (p: Product, size: string) => {
    const existing = cart.find(i => i.productId === p.id && i.size === size);
    if (existing && existing.quantity >= MAX_QUANTITY) { setAnnouncement(`Máximo ${MAX_QUANTITY} unidades por talla.`); return; }
    setCart(c => normalizeCart([...c, { productId: p.id, size, quantity: 1 }], products));
    setSelected(null); setAnnouncement(`${p.name} se agregó a tu bolsa.`);
  };
  const updateQuantity = (item: CartItem, quantity: number) => setCart(c => c.flatMap(i => lineKey(i) === lineKey(item) ? quantity < 1 ? [] : [{ ...i, quantity: Math.min(MAX_QUANTITY, quantity) }] : [i]));

  return <div style={{ '--primary': store.colors.primary, '--accent': store.colors.accent, '--background': store.colors.background } as CSSProperties}>
    <a className="skip-link" href="#catalogo">Ir al catálogo</a>
    <div className="announcement-bar"><span>PUNTO AZUL / MODA URBANA</span><span className="announcement-extra">VISTE A TU MANERA</span></div>
    <header className="nav-shell"><nav className="navbar" aria-label="Navegación principal">
      <a href="#inicio" className="brand" aria-label={`${store.name}, inicio`}><img src={store.logo} alt="" width="44" height="44"/><span>{store.name}<small>{store.tagline}</small></span></a>
      <div className="desktop-nav"><a href="#catalogo" onClick={() => chooseCategory('all')}>Colección</a>{categories.map(c => <button key={c.id} onClick={() => chooseCategory(c.id)}>{c.name}</button>)}<a href="#nosotros">Nosotros</a></div>
      <div className="nav-actions"><button className="bag-button" onClick={() => { setMenu(false); setBag(true); }} aria-label={`Abrir bolsa, ${count} productos`}><Icon name="bag"/><span className="bag-label">Mi bolsa</span><span className="bag-count">{count}</span></button><button className="icon-button menu-toggle" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'}/></button></div>
    </nav>{menu && <div className="mobile-menu" id="mobile-menu"><a href="#catalogo" onClick={() => chooseCategory('all')}>Toda la colección</a>{categories.map(c => <button key={c.id} onClick={() => chooseCategory(c.id)}>{c.name}<span>{c.subtitle}</span></button>)}<a href="#nosotros" onClick={() => setMenu(false)}>Nosotros</a></div>}</header>

    <main>
      <section className="hero" id="inicio"><div className="hero-visual" aria-hidden="true"><div className="urban-orbit"/><img src={store.logo} alt=""/><span>LA CALLE TIENE TU FIRMA</span></div><div className="hero-overlay"/>
        <div className="hero-inner"><div className="hero-copy"><span className="eyebrow"><span className="tiny-star">✳</span> {store.hero.eyebrow}</span><h1>{store.hero.title}<br/><em>{store.hero.titleAccent}</em></h1><p>{store.hero.subtitle}</p><a className="button primary" href="#catalogo">Explorar catálogo</a><div className="hero-note"><span className="note-line"/> Tu estilo no necesita permiso.</div></div></div>
        <div className="hero-stamp"><Icon name="sun" size={28}/><span>CREA<br/>TU ESTILO</span></div>
      </section>
      <div className="values-strip"><span><Icon name="heart"/> Estilo con personalidad</span><span><Icon name="sun"/> Prendas para tu día a día</span><span><Icon name="chat"/> Atención por WhatsApp</span></div>

      <section className="catalog-section container" id="catalogo" aria-labelledby="catalog-title">
        <div className="section-heading"><div><span className="eyebrow accent">ELIGE TU PRÓXIMO LOOK</span><h2 id="catalog-title">FUERA DE LO COMÚN<span>.</span></h2></div><p>Polos, denim y capas.<br className="desktop-break"/> Un mismo punto: tu estilo.</p></div>
        {store.demo && products.length > 0 && <div className="demo-notice"><span className="demo-label">CATÁLOGO DEMO</span><span>Productos y precios de ejemplo. Los pedidos se enviarán como prueba.</span></div>}
        <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label="Filtrar por categoría"><button aria-pressed={category === 'all'} className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Ver todo</button>{categories.map(c => <button key={c.id} aria-pressed={category === c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)}>{c.name}</button>)}</div><label className="search-box"><Icon name="search" size={19}/><input type="search" aria-label="Buscar productos" placeholder="Busca una prenda…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        <div className="results-bar"><span aria-live="polite">{catalog ? `${filtered.length} productos para descubrir` : 'Preparando nuestra colección…'}</span><label>Ordenar por <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Ordenar productos"><option value="featured">Destacados</option><option value="low">Menor precio</option><option value="high">Mayor precio</option></select></label></div>
        {error ? <div className="empty-state" role="alert"><Icon name="leaf" size={40}/><h3>No pudimos abrir la colección</h3><p>Revisa tu conexión y vuelve a intentarlo.</p><button className="button primary" onClick={() => setAttempt(a => a + 1)}>Intentar de nuevo</button></div> : !catalog ? <div className="product-grid" aria-label="Cargando productos" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton"/>)}</div> : !filtered.length ? <div className="empty-state"><Icon name="search" size={40}/><h3>{products.length ? 'Aún no encontramos ese producto' : 'TU PRÓXIMO LOOK ESTÁ EN CAMINO'}</h3><p>{products.length ? 'Prueba con otro nombre o explora toda la colección.' : 'Estamos preparando el catálogo PUNTO AZUL. Pronto podrás descubrir nuestros productos aquí.'}</p>{products.length > 0 && <button className="button secondary" onClick={() => { setSearch(''); setCategory('all'); }}>Ver toda la colección</button>}</div> : <div className="product-grid">{filtered.map(p => <article key={p.id} className="product-card">
          <button className="product-photo" aria-label={`Ver ${p.name}`} onClick={() => setSelected(p)}><ProductImage src={p.image} alt={`Imagen de ${p.name}, color ${p.color}`} />{(!p.available || p.badge) && <span className={`product-badge ${!p.available ? 'sold-out' : ''}`}>{!p.available ? 'No disponible' : p.badge}</span>}<span className="quick-view">Ver producto</span></button>
          <div className="product-meta"><span>{categories.find(c => c.id === p.categoryId)?.name} <span aria-hidden="true">/</span> {p.color}</span><span className="swatch" style={{ background: colorHex(p.color) }}/></div>
          <div className="product-title-row"><h3><button onClick={() => setSelected(p)}>{p.name}</button></h3><span className="price">{productPrice(p)}</span></div><div className="card-bottom"><span>{needsInquiry(p) ? 'Tallas por confirmar' : `${p.sizes[0]} – ${p.sizes.at(-1)}`}</span><button className="add-button" disabled={!p.available} onClick={() => setSelected(p)} aria-label={`Elegir talla de ${p.name}`}><Icon name="bag" size={18}/><span>{needsInquiry(p) ? 'Consultar' : 'Elegir'}</span></button></div>
        </article>)}</div>}
      </section>

      <section className="story-section container" id="nosotros"><div className="story-art" aria-hidden="true"><div className="story-orbit"/><img src={store.logo} alt=""/><span>ESTILO SIN PERMISO</span><i className="spark one">✳</i><i className="spark two">✧</i></div><div className="story-copy"><span className="eyebrow accent">SOMOS PUNTO AZUL</span><h2>TODO EMPIEZA<br/><em>CON TU ACTITUD.</em></h2><p>{store.about}</p><a className="text-link" href={contactUrl} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={19}/>Conversemos por WhatsApp</a></div></section>
      <section className="contact-strip container" id="contacto"><div><h2>¿Te ayudamos a elegir?</h2><p>Hablemos de tallas, prendas y ese look que tienes en mente.</p></div><a className="button primary" href={contactUrl} target="_blank" rel="noopener noreferrer"><Icon name="chat"/>Escríbenos</a></section>
    </main>
    <footer className="footer"><div className="container footer-main"><a className="brand" href="#inicio"><img src={store.logo} width="48" height="48" alt=""/><span>{store.name}<small>{store.tagline}</small></span></a><div><span className="footer-label">EXPLORA</span><a href="#catalogo">La colección</a><a href="#nosotros">Nosotros</a><a href="/admin" className="admin-entry">Administrar tienda</a></div>{(store.address || store.hours || store.instagram || store.facebook) && <div><span className="footer-label">ESTAMOS CERCA</span>{store.address && <span>{store.address}</span>}{store.hours && <span>{store.hours}</span>}{store.instagram && <a href={store.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}{store.facebook && <a href={store.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}</div>}</div><div className="container footer-bottom"><span>© {new Date().getFullYear()} {store.name}. Moda urbana.</span><span>TU CALLE. TU ESTILO.</span></div><a className="whatsapp-float" href={contactUrl} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp" title="Escríbenos por WhatsApp"><Icon name="whatsapp" size={32}/></a></footer>
    <div role="status" aria-live="polite" className={announcement ? 'toast visible' : 'toast'}>{announcement}</div>

    {selected && <Dialog title="Detalles del producto" onClose={() => setSelected(null)}><ProductDetail key={selected.id} product={selected} onAdd={add}/></Dialog>}
    {bag && <Dialog title={`Mi bolsa (${count})`} drawer onClose={() => setBag(false)}>{cart.length ? <><div className="cart-items">{cart.map(item => { const p = products.find(p => p.id === item.productId)!; return <div className="cart-item" key={lineKey(item)}><ProductImage src={p.image} alt={p.name}/><div><h3>{p.name}</h3><p className="small muted">{p.color} · {item.size}</p><strong>{money(p.price * item.quantity)}</strong><div className="cart-controls"><div className="quantity"><button aria-label={`Reducir cantidad de ${p.name}, ${item.size}`} onClick={() => updateQuantity(item, item.quantity - 1)}>−</button><span aria-label="Cantidad">{item.quantity}</span><button aria-label={`Aumentar cantidad de ${p.name}, ${item.size}`} disabled={item.quantity >= MAX_QUANTITY} onClick={() => updateQuantity(item, item.quantity + 1)}>+</button></div><button className="remove-button" onClick={() => updateQuantity(item, 0)}>Eliminar<span className="sr-only"> {p.name}, {item.size}</span></button></div></div></div>; })}</div><div className="cart-summary"><div className="subtotal"><span>Subtotal</span><strong>{money(subtotal(cart, products))}</strong></div><p className="small muted">Entrega y disponibilidad por confirmar. No se realiza ningún cobro en esta página.</p>{store.demo && <p className="demo-inline">Tu mensaje indicará que este es un pedido de prueba.</p>}{storageWarning && <p role="status" className="small">Tu navegador no permite guardar la bolsa. Consérvala abierta hasta enviar el pedido.</p>}<a className="button primary full" href={orderUrl} target="_blank" rel="noopener noreferrer"><Icon name="chat"/>Preparar pedido por WhatsApp</a><button className="continue-button" onClick={() => setBag(false)}>Seguir descubriendo</button></div></> : <div className="empty-state cart-empty"><Icon name="bag" size={50}/><h2>TU PRÓXIMO LOOK<br/>EMPIEZA AQUÍ</h2><p>Explora la colección y encuentra tu próxima prenda favorita.</p><button className="button primary" onClick={() => { setBag(false); chooseCategory('all'); }}>Explorar la colección</button></div>}</Dialog>}
  </div>;
}
