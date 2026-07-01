import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, MapPin, Clock, Heart, Plus, Store, User, X, Tag, Sparkles, ChevronRight, Check, LogOut } from "lucide-react";

// ---------- Supabase ----------
// Remplace ces 2 valeurs par celles de ton projet Supabase (Settings > API)
const SUPABASE_URL = "https://umkbuyconjhlbxuhmjfp.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "Umkbuyconjhlbxuhmjfp";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Identifiant anonyme de l'appareil, stocké dans le navigateur (remplace window.storage local)
function getDeviceId() {
  let id = localStorage.getItem("yoondeal_device_id");
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("yoondeal_device_id", id);
  }
  return id;
}

// ---------- Design tokens ----------
// Indigo nuit (bg), Orange baobab (primary), Jaune taxi (secondary), Vert teranga (success), Blanc cassé (text/light)
const COLORS = {
  night: "#1B1B3A",
  nightDeep: "#13132B",
  baobab: "#E85D2B",
  taxi: "#FFC93C",
  teranga: "#2D7D5A",
  cream: "#F5F1E8",
};

const CATEGORIES = [
  { id: "resto", label: "Restos", emoji: "🍛" },
  { id: "sortie", label: "Sorties", emoji: "🎉" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "beaute", label: "Beauté", emoji: "✂️" },
  { id: "sport", label: "Sport", emoji: "🏀" },
];

const QUARTIERS = ["Plateau", "Almadies", "Mermoz", "Ngor", "Sacré-Cœur", "Yoff", "Ouakam", "Liberté 6", "Parcelles"];

const SEED_DEALS = [
  { id: "d1", title: "Thiéboudienne pour 2, prix de 1", merchant: "Chez Aïda", category: "resto", quartier: "Mermoz", discount: 50, price: 4000, originalPrice: 8000, expiresInDays: 3, premium: true, desc: "Un thiéboudienne généreux à partager, fait maison. Valable midi uniquement.", img: "🍛" },
  { id: "d2", title: "Entrée boîte -30% avant minuit", merchant: "Pulse Club", category: "sortie", quartier: "Almadies", discount: 30, price: 3500, originalPrice: 5000, expiresInDays: 1, premium: true, desc: "Entrée + 1 boisson offerte si tu arrives avant minuit.", img: "🎉" },
  { id: "d3", title: "2 t-shirts streetwear achetés = 1 casquette offerte", merchant: "221 Wear", category: "shopping", quartier: "Plateau", discount: 0, price: 0, originalPrice: 0, expiresInDays: 7, premium: false, desc: "Sur toute la collection capsule Dakar.", img: "🧢" },
  { id: "d4", title: "Coupe + dégradé -40%", merchant: "Fresh Cuts Barber", category: "beaute", quartier: "Sacré-Cœur", discount: 40, price: 1500, originalPrice: 2500, expiresInDays: 5, premium: false, desc: "Sur présentation du code, du lundi au jeudi.", img: "✂️" },
  { id: "d5", title: "Abonnement salle 1 mois -25%", merchant: "Iron Gym Ngor", category: "sport", quartier: "Ngor", discount: 25, price: 15000, originalPrice: 20000, expiresInDays: 10, premium: true, desc: "Accès illimité, coach inclus la première semaine.", img: "🏋️" },
  { id: "d6", title: "Jus + Fataya à 1000F", merchant: "Snack Téranga", category: "resto", quartier: "Liberté 6", discount: 0, price: 1000, originalPrice: 1500, expiresInDays: 4, premium: false, desc: "Formule étudiant, toute la journée.", img: "🥤" },
];

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Subscription config ----------
const PAYMENT_NUMBER = "77 227 69 91";
const SUB_INTRO_PRICE = 1500; // FCFA / mois, les 3 premiers mois
const SUB_INTRO_MONTHS = 3;
const SUB_FULL_PRICE = 5000; // FCFA / mois, à partir du 4e mois

function priceForMonth(monthIndex) {
  // monthIndex: 1 = premier mois payé par ce commerçant
  return monthIndex <= SUB_INTRO_MONTHS ? SUB_INTRO_PRICE : SUB_FULL_PRICE;
}

function daysLeftLabel(days) {
  if (days <= 0) return "Expire aujourd'hui";
  if (days === 1) return "Plus que 1 jour";
  return `Plus que ${days} jours`;
}

// ---------- Supabase helpers ----------
// Tables attendues (voir le script SQL fourni) :
// deals(id, data jsonb, created_at)
// favorites(device_id, deal_id)
// redeemed(device_id, deal_id, code)
// subscriptions(merchant text primary key, months_paid int)

async function fetchDeals() {
  const { data, error } = await supabase.from("deals").select("data").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map((row) => row.data);
}
async function insertDeal(deal) {
  await supabase.from("deals").insert({ id: deal.id, data: deal });
}
async function fetchFavorites(deviceId) {
  const { data, error } = await supabase.from("favorites").select("deal_id").eq("device_id", deviceId);
  if (error) return [];
  return data.map((r) => r.deal_id);
}
async function toggleFavoriteRow(deviceId, dealId, isFav) {
  if (isFav) {
    await supabase.from("favorites").delete().eq("device_id", deviceId).eq("deal_id", dealId);
  } else {
    await supabase.from("favorites").insert({ device_id: deviceId, deal_id: dealId });
  }
}
async function fetchRedeemed(deviceId) {
  const { data, error } = await supabase.from("redeemed").select("deal_id, code").eq("device_id", deviceId);
  if (error) return {};
  const map = {};
  data.forEach((r) => { map[r.deal_id] = r.code; });
  return map;
}
async function insertRedeemed(deviceId, dealId, code) {
  await supabase.from("redeemed").insert({ device_id: deviceId, deal_id: dealId, code });
}
async function fetchSubscriptions() {
  const { data, error } = await supabase.from("subscriptions").select("merchant, months_paid");
  if (error) return {};
  const map = {};
  data.forEach((r) => { map[r.merchant] = r.months_paid; });
  return map;
}
async function upsertSubscription(merchant, monthsPaid) {
  await supabase.from("subscriptions").upsert({ merchant, months_paid: monthsPaid });
}

// ---------- Ticket-style Deal Card (signature element) ----------
function DealCard({ deal, isFav, onToggleFav, onOpen }) {
  const cat = CATEGORIES.find((c) => c.id === deal.category);
  return (
    <div
      onClick={() => onOpen(deal)}
      className="relative cursor-pointer group"
      style={{
        background: COLORS.cream,
        borderRadius: 18,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      {/* perforated edge */}
      <div
        className="flex items-center justify-between px-5 pt-4"
        style={{ color: COLORS.night }}
      >
        <span className="text-2xl">{deal.img}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(deal.id); }}
          aria-label="Ajouter aux favoris"
          className="transition-transform active:scale-90"
        >
          <Heart
            size={20}
            fill={isFav ? COLORS.baobab : "none"}
            stroke={isFav ? COLORS.baobab : COLORS.night}
          />
        </button>
      </div>

      <div className="px-5 pt-2 pb-1">
        <p className="text-[11px] uppercase tracking-wider font-bold" style={{ color: COLORS.teranga }}>
          {deal.merchant} · {deal.quartier}
        </p>
        <h3 className="text-lg font-extrabold leading-snug mt-1" style={{ color: COLORS.night, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          {deal.title}
        </h3>
      </div>

      {/* perforation line */}
      <div className="relative my-3 mx-5">
        <div className="absolute -left-9 -top-2.5 w-5 h-5 rounded-full" style={{ background: COLORS.night }} />
        <div className="absolute -right-9 -top-2.5 w-5 h-5 rounded-full" style={{ background: COLORS.night }} />
        <div
          className="border-t-2 border-dashed"
          style={{ borderColor: "rgba(27,27,58,0.25)" }}
        />
      </div>

      <div className="flex items-center justify-between px-5 pb-4">
        <div className="flex items-baseline gap-2">
          {deal.discount > 0 ? (
            <span className="text-xl font-black" style={{ color: COLORS.baobab }}>-{deal.discount}%</span>
          ) : deal.price > 0 ? (
            <span className="text-xl font-black" style={{ color: COLORS.baobab }}>{deal.price.toLocaleString()} F</span>
          ) : (
            <span className="text-sm font-black" style={{ color: COLORS.baobab }}>OFFRE BONUS</span>
          )}
          {deal.originalPrice > 0 && (
            <span className="text-xs line-through opacity-50" style={{ color: COLORS.night }}>
              {deal.originalPrice.toLocaleString()} F
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: deal.expiresInDays <= 1 ? COLORS.baobab : "rgba(27,27,58,0.6)" }}>
          <Clock size={12} /> {daysLeftLabel(deal.expiresInDays)}
        </span>
      </div>

      {deal.premium && (
        <div
          className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-[10px] font-black flex items-center gap-1 rotate-3"
          style={{ background: COLORS.taxi, color: COLORS.night }}
        >
          <Sparkles size={11} /> TOP DEAL
        </div>
      )}
    </div>
  );
}

// ---------- Deal Detail / Redeem Modal ----------
function DealModal({ deal, onClose, isFav, onToggleFav, onRedeem, code }) {
  if (!deal) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(19,19,43,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[88vh] overflow-y-auto"
        style={{ background: COLORS.cream }}
      >
        <div className="relative h-32 flex items-center justify-center text-6xl" style={{ background: `linear-gradient(135deg, ${COLORS.night}, ${COLORS.nightDeep})` }}>
          {deal.img}
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full" style={{ background: "rgba(245,241,232,0.15)" }}>
            <X size={18} color={COLORS.cream} />
          </button>
          <button
            onClick={() => onToggleFav(deal.id)}
            className="absolute top-4 left-4 p-2 rounded-full"
            style={{ background: "rgba(245,241,232,0.15)" }}
          >
            <Heart size={18} fill={isFav ? COLORS.baobab : "none"} color={isFav ? COLORS.baobab : COLORS.cream} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs uppercase tracking-wider font-bold" style={{ color: COLORS.teranga }}>
            {deal.merchant} · {deal.quartier}
          </p>
          <h2 className="text-2xl font-black mt-1" style={{ color: COLORS.night, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            {deal.title}
          </h2>
          <p className="text-sm mt-3 opacity-80" style={{ color: COLORS.night }}>{deal.desc}</p>

          <div className="flex items-center gap-2 mt-4 text-xs font-semibold" style={{ color: COLORS.baobab }}>
            <Clock size={14} /> {daysLeftLabel(deal.expiresInDays)}
          </div>

          {code ? (
            <div className="mt-6 rounded-2xl p-5 text-center" style={{ background: COLORS.night }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.taxi }}>Ton code de réduction</p>
              <p className="text-3xl font-black tracking-[0.3em] mt-2" style={{ color: COLORS.cream, fontFamily: "monospace" }}>{code}</p>
              <p className="text-[11px] mt-2 opacity-60" style={{ color: COLORS.cream }}>Montre ce code au commerçant</p>
            </div>
          ) : (
            <button
              onClick={() => onRedeem(deal)}
              className="w-full mt-6 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: COLORS.baobab, color: COLORS.cream }}
            >
              <Tag size={18} /> Obtenir le code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Subscribe / Payment Modal ----------
function SubscribeModal({ monthIndex, merchantName, onClose, onConfirm }) {
  const [copied, setCopied] = useState(false);
  const price = priceForMonth(monthIndex);
  const isIntro = monthIndex <= SUB_INTRO_MONTHS;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_NUMBER.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(19,19,43,0.75)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6" style={{ background: COLORS.cream }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black" style={{ color: COLORS.night, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Mettre en avant ton deal
          </h2>
          <button onClick={onClose}><X size={20} color={COLORS.night} /></button>
        </div>
        <p className="text-xs opacity-60 mt-1" style={{ color: COLORS.night }}>
          {merchantName ? `Pour ${merchantName} · ` : ""}Mois {monthIndex} de ton abonnement Top Deal
        </p>

        <div className="rounded-2xl p-5 mt-4" style={{ background: COLORS.night }}>
          <p className="text-[11px] uppercase tracking-widest" style={{ color: COLORS.taxi }}>
            {isIntro ? `Tarif de lancement (mois 1 à ${SUB_INTRO_MONTHS})` : "Tarif standard"}
          </p>
          <p className="text-3xl font-black mt-1" style={{ color: COLORS.cream }}>
            {price.toLocaleString()} F<span className="text-sm font-medium opacity-60">/mois</span>
          </p>
          {isIntro && (
            <p className="text-[11px] mt-1 opacity-70" style={{ color: COLORS.cream }}>
              Puis {SUB_FULL_PRICE.toLocaleString()} F/mois à partir du {SUB_INTRO_MONTHS + 1}ᵉ mois
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold" style={{ color: COLORS.night }}>Comment payer :</p>
          <ol className="text-sm space-y-1.5 list-decimal list-inside" style={{ color: COLORS.night }}>
            <li>Envoie <strong>{price.toLocaleString()} F</strong> par Wave ou Orange Money au</li>
          </ol>
          <button
            onClick={copyNumber}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-black text-lg"
            style={{ background: COLORS.taxi, color: COLORS.night }}
          >
            <span style={{ fontFamily: "monospace" }}>{PAYMENT_NUMBER}</span>
            <span className="text-xs font-bold">{copied ? "Copié ✓" : "Copier"}</span>
          </button>
          <p className="text-[11px] opacity-60" style={{ color: COLORS.night }}>
            Une fois le transfert effectué, confirme ci-dessous. Ton deal passe en "Top Deal" immédiatement.
          </p>
        </div>

        <button
          onClick={() => onConfirm(price)}
          className="w-full mt-5 py-4 rounded-2xl font-black text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
          style={{ background: COLORS.baobab, color: COLORS.cream }}
        >
          <Check size={18} /> J'ai payé, activer mon Top Deal
        </button>
      </div>
    </div>
  );
}

// ---------- Submit Deal Form (merchant) ----------
function SubmitDealForm({ onClose, onSubmit, onRequestSubscribe, nextMonthIndex }) {
  const [form, setForm] = useState({
    title: "", merchant: "", category: "resto", quartier: QUARTIERS[0],
    discount: "", price: "", originalPrice: "", expiresInDays: 7, desc: "", premium: false, img: "🏷️",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title.trim() || !form.merchant.trim()) return;
    onSubmit({
      ...form,
      id: uid("deal"),
      discount: Number(form.discount) || 0,
      price: Number(form.price) || 0,
      originalPrice: Number(form.originalPrice) || 0,
      expiresInDays: Number(form.expiresInDays) || 1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(19,19,43,0.7)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-6" style={{ background: COLORS.cream }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black" style={{ color: COLORS.night, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Publier un deal</h2>
          <button onClick={onClose}><X size={20} color={COLORS.night} /></button>
        </div>

        <div className="space-y-3">
          <Input label="Nom de l'offre" value={form.title} onChange={(v) => set("title", v)} placeholder="Ex: Pizza familiale -30%" />
          <Input label="Nom de ton commerce" value={form.merchant} onChange={(v) => set("merchant", v)} placeholder="Ex: Chez Fatou" />

          <div>
            <Label>Catégorie</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => set("category", c.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border-2"
                  style={{
                    borderColor: form.category === c.id ? COLORS.baobab : "rgba(27,27,58,0.15)",
                    background: form.category === c.id ? COLORS.baobab : "transparent",
                    color: form.category === c.id ? COLORS.cream : COLORS.night,
                  }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Quartier</Label>
            <select value={form.quartier} onChange={(e) => set("quartier", e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border-2 text-sm font-medium"
              style={{ borderColor: "rgba(27,27,58,0.15)", color: COLORS.night }}>
              {QUARTIERS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input label="% réduction" value={form.discount} onChange={(v) => set("discount", v)} placeholder="30" type="number" />
            <Input label="Prix (F)" value={form.price} onChange={(v) => set("price", v)} placeholder="3500" type="number" />
            <Input label="Prix barré" value={form.originalPrice} onChange={(v) => set("originalPrice", v)} placeholder="5000" type="number" />
          </div>

          <Input label="Durée (jours)" value={form.expiresInDays} onChange={(v) => set("expiresInDays", v)} type="number" />

          <div>
            <Label>Description</Label>
            <textarea value={form.desc} onChange={(e) => set("desc", e.target.value)} rows={3}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border-2 text-sm"
              style={{ borderColor: "rgba(27,27,58,0.15)", color: COLORS.night }}
              placeholder="Conditions, horaires, détails..." />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            {form.premium ? (
              <span className="flex items-center gap-2 text-xs font-bold" style={{ color: COLORS.teranga }}>
                <Check size={16} /> Top Deal activé pour ce mois-ci ✓
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRequestSubscribe(form.merchant, (ok, price) => { if (ok) set("premium", true); })}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full"
                style={{ background: "rgba(255,201,60,0.25)", color: COLORS.night }}
              >
                <Sparkles size={14} /> Mettre en avant ce deal — à partir de {SUB_INTRO_PRICE.toLocaleString()} F/mois
              </button>
            )}
          </label>

          <button onClick={submit}
            className="w-full mt-2 py-4 rounded-2xl font-black text-base active:scale-95 transition-transform"
            style={{ background: COLORS.teranga, color: COLORS.cream }}>
            Publier le deal
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(27,27,58,0.6)" }}>{children}</span>;
}
function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 px-3 py-2.5 rounded-xl border-2 text-sm font-medium outline-none focus:border-current"
        style={{ borderColor: "rgba(27,27,58,0.15)", color: "#1B1B3A" }}
      />
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [deals, setDeals] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [redeemed, setRedeemed] = useState({}); // dealId -> code
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [view, setView] = useState("home"); // home | favorites | submit
  const [openDeal, setOpenDeal] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [subscribeRequest, setSubscribeRequest] = useState(null); // {merchant, callback}
  const [subscriptions, setSubscriptions] = useState({}); // merchantName -> monthsPaid
  const [toast, setToast] = useState(null);

  // Load deals + personal favorites/redeemed on mount
  useEffect(() => {
    (async () => {
      const deviceId = getDeviceId();
      const [sharedDeals, favs, red, subs] = await Promise.all([
        fetchDeals(),
        fetchFavorites(deviceId),
        fetchRedeemed(deviceId),
        fetchSubscriptions(),
      ]);
      // Si la base est vide au tout premier lancement, on l'initialise avec les deals de démo
      if (sharedDeals.length === 0) {
        await Promise.all(SEED_DEALS.map((d) => insertDeal(d)));
        setDeals(SEED_DEALS);
      } else {
        setDeals(sharedDeals);
      }
      setFavorites(favs);
      setRedeemed(red);
      setSubscriptions(subs);
      setLoading(false);
    })();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const toggleFav = useCallback(async (id) => {
    const deviceId = getDeviceId();
    const isFav = favorites.includes(id);
    setFavorites((prev) => (isFav ? prev.filter((f) => f !== id) : [...prev, id]));
    await toggleFavoriteRow(deviceId, id, isFav);
  }, [favorites]);

  const redeemDeal = useCallback(async (deal) => {
    const deviceId = getDeviceId();
    const code = `YD-${deal.id.slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    setRedeemed((prev) => ({ ...prev, [deal.id]: code }));
    await insertRedeemed(deviceId, deal.id, code);
    showToast("Code généré ✓");
  }, []);

  const addDeal = useCallback(async (deal) => {
    setDeals((prev) => [deal, ...prev]);
    await insertDeal(deal);
    setShowSubmit(false);
    showToast("Deal publié sur Yoon Deal ✓");
  }, []);

  const handleRequestSubscribe = useCallback((merchantName, callback) => {
    const name = (merchantName || "Mon commerce").trim() || "Mon commerce";
    setSubscribeRequest({ merchant: name, callback });
  }, []);

  const confirmSubscribe = useCallback(async (price) => {
    if (!subscribeRequest) return;
    const name = subscribeRequest.merchant;
    const newCount = (subscriptions[name] || 0) + 1;
    setSubscriptions((prev) => ({ ...prev, [name]: newCount }));
    await upsertSubscription(name, newCount);
    subscribeRequest.callback?.(true, price);
    setSubscribeRequest(null);
    showToast(`Paiement de ${price.toLocaleString()} F confirmé — Top Deal activé ✓`);
  }, [subscribeRequest, subscriptions]);

  const filteredDeals = deals.filter((d) => {
    const matchCat = activeCat === "all" || d.category === activeCat;
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.merchant.toLowerCase().includes(q) || d.quartier.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const favDeals = deals.filter((d) => favorites.includes(d.id));
  const listToShow = view === "favorites" ? favDeals : filteredDeals;

  return (
    <div className="min-h-screen w-full font-sans" style={{ background: COLORS.night, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 px-5 pt-6 pb-4" style={{ background: COLORS.night }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-1" style={{ color: COLORS.cream, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Yoon<span style={{ color: COLORS.taxi }}>Deal</span>
            </h1>
            <p className="text-[11px] font-medium opacity-60" style={{ color: COLORS.cream }}>Les meilleurs plans de Dakar, chaque jour</p>
          </div>
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full font-bold text-xs active:scale-95 transition-transform"
            style={{ background: COLORS.baobab, color: COLORS.cream }}
          >
            <Store size={14} /> Publier
          </button>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mt-4 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" color="rgba(245,241,232,0.5)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Resto, quartier, type de sortie..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm font-medium outline-none"
            style={{ background: "rgba(245,241,232,0.08)", color: COLORS.cream }}
          />
        </div>

        {/* Categories */}
        <div className="max-w-2xl mx-auto flex gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="Tout" emoji="✨" />
          {CATEGORIES.map((c) => (
            <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.label} emoji={c.emoji} />
          ))}
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-5 pb-28 pt-2">
        {loading ? (
          <div className="text-center py-20 text-sm opacity-50" style={{ color: COLORS.cream }}>Chargement des deals...</div>
        ) : listToShow.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">{view === "favorites" ? "💔" : "🔍"}</p>
            <p className="font-bold" style={{ color: COLORS.cream }}>
              {view === "favorites" ? "Aucun favori pour l'instant" : "Aucun deal trouvé"}
            </p>
            <p className="text-xs opacity-50 mt-1" style={{ color: COLORS.cream }}>
              {view === "favorites" ? "Tape sur le cœur d'un deal pour le garder ici" : "Essaie une autre recherche ou catégorie"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 mt-3">
            {listToShow.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                isFav={favorites.includes(deal.id)}
                onToggleFav={toggleFav}
                onOpen={setOpenDeal}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-5 py-3" style={{ background: COLORS.nightDeep, borderTop: "1px solid rgba(245,241,232,0.08)" }}>
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          <NavBtn active={view === "home"} onClick={() => setView("home")} icon={<Sparkles size={20} />} label="Deals" />
          <NavBtn active={view === "favorites"} onClick={() => setView("favorites")} icon={<Heart size={20} />} label="Favoris" badge={favorites.length} />
          <NavBtn active={false} onClick={() => setShowSubmit(true)} icon={<Plus size={20} />} label="Publier" />
        </div>
      </nav>

      {openDeal && (
        <DealModal
          deal={openDeal}
          onClose={() => setOpenDeal(null)}
          isFav={favorites.includes(openDeal.id)}
          onToggleFav={toggleFav}
          onRedeem={redeemDeal}
          code={redeemed[openDeal.id]}
        />
      )}

      {showSubmit && (
        <SubmitDealForm
          onClose={() => setShowSubmit(false)}
          onSubmit={addDeal}
          onRequestSubscribe={handleRequestSubscribe}
        />
      )}

      {subscribeRequest && (
        <SubscribeModal
          monthIndex={(subscriptions[subscribeRequest.merchant] || 0) + 1}
          merchantName={subscribeRequest.merchant}
          onClose={() => setSubscribeRequest(null)}
          onConfirm={confirmSubscribe}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full font-bold text-sm flex items-center gap-2"
          style={{ background: COLORS.teranga, color: COLORS.cream }}>
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function CatChip({ active, onClick, label, emoji }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors"
      style={{
        background: active ? "#FFC93C" : "rgba(245,241,232,0.08)",
        color: active ? "#1B1B3A" : "#F5F1E8",
      }}>
      <span>{emoji}</span>{label}
    </button>
  );
}

function NavBtn({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 relative px-4 py-1">
      <span style={{ color: active ? "#FFC93C" : "rgba(245,241,232,0.5)" }}>{icon}</span>
      <span className="text-[10px] font-bold" style={{ color: active ? "#FFC93C" : "rgba(245,241,232,0.5)" }}>{label}</span>
      {badge > 0 && (
        <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center" style={{ background: "#E85D2B", color: "#F5F1E8" }}>
          {badge}
        </span>
      )}
    </button>
  );
}
