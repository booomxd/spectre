// Storefront, wallet and rank snapshot for the dashboard and shop.
use crate::core::error::Res;
use crate::core::{js, truthy, Ctx, Registry};
use serde_json::{json, Map, Value};

const VP: &str = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";

/// `o.k` keeping JS undefined (missing key) apart from null.
fn g(v: &Value, k: &str) -> Option<Value> { v.get(k).cloned() }

/// A JS object literal: `None` values are undefined, which JSON.stringify leaves out.
fn def<const N: usize>(pairs: [(&str, Option<Value>); N]) -> Value {
    let mut m = Map::new();
    for (k, v) in pairs { if let Some(v) = v { m.insert(k.to_string(), v); } }
    Value::Object(m)
}

/// Object keys in JS order: integer-like keys ascending first, then the rest in insertion order.
fn js_keys(v: &Value) -> Vec<String> {
    let Some(o) = v.as_object() else { return Vec::new() };
    let idx = |k: &str| k.parse::<u32>().ok().filter(|n| *n != u32::MAX && n.to_string() == k);
    let mut ints: Vec<(u32, String)> = o.keys().filter_map(|k| idx(k).map(|n| (n, k.clone()))).collect();
    ints.sort_by_key(|x| x.0);
    let mut out: Vec<String> = ints.into_iter().map(|x| x.1).collect();
    out.extend(o.keys().filter(|k| idx(k).is_none()).cloned());
    out
}

/// `Object.values(v || {})[0]` (None = undefined).
fn first_value(v: &Value) -> Option<Value> { js_keys(v).first().map(|k| v[k.as_str()].clone()) }
/// `Object.keys(v || {})[0]`.
fn first_key(v: &Value) -> Option<Value> { js_keys(v).first().map(|k| Value::String(k.clone())) }

/// `o.Rewards?.[0]?.<k>`.
fn reward(o: &Value, k: &str) -> Option<Value> { o.get("Rewards").and_then(|r| r.get(0)).and_then(|r| r.get(k)).cloned() }

/// `Math.max` over numbers (NaN if any is NaN).
fn max(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else { a.max(b) } }

pub(crate) async fn storefront(ctx: &Ctx) -> Res<Value> {
    let p = ctx.riot.puuid();
    match ctx.riot.pd("post", &format!("store/v3/storefront/{p}"), Some(json!({}))).await {
        Ok(v) => Ok(v),
        Err(_) => ctx.riot.pd("get", &format!("store/v2/storefront/{p}"), None).await,
    }
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("store:wallet", |ctx, _| async move {
        let w = ctx.riot.pd("get", &format!("store/v1/wallet/{}", ctx.riot.puuid()), None).await?;
        let b = &w["Balances"];
        Ok(json!({
            "vp": js::nullish(&b[VP], json!(0)),
            "rad": js::nullish(&b["e59aa87c-4cbf-517a-5983-6e81511be9b7"], json!(0)),
            "kc": js::nullish(&b["85ca954a-41f2-ce94-9b45-8ca3dd39a00d"], json!(0)),
        }))
    });

    reg.add("store:storefront", |ctx, _| async move {
        let s = storefront(&ctx).await?;
        let fb = &s["FeaturedBundle"];
        let list = if truthy(&fb["Bundles"]) { js::arr(&fb["Bundles"]) } else if truthy(&fb["Bundle"]) { vec![fb["Bundle"].clone()] } else { vec![] };
        let bundles: Vec<Value> = list.iter().map(|b| def([
            ("id", g(b, "DataAssetID")),
            ("secondsLeft", g(b, "DurationRemainingInSeconds")),
            ("totalBase", Some(js::nullish(&b["TotalBaseCost"][VP], Value::Null))),
            ("totalDiscounted", Some(js::nullish(&b["TotalDiscountedCost"][VP], Value::Null))),
            ("discountPercent", Some(js::or(&b["TotalDiscountPercent"], json!(0)))),
            ("wholesaleOnly", Some(json!(truthy(&b["WholesaleOnly"])))),
            ("items", Some(Value::Array(js::arr(&b["Items"]).iter().map(|i| def([
                ("id", g(&i["Item"], "ItemID")), ("typeId", g(&i["Item"], "ItemTypeID")), ("amount", g(&i["Item"], "Amount")),
                ("base", g(i, "BasePrice")), ("price", g(i, "DiscountedPrice")), ("discount", g(i, "DiscountPercent")),
            ])).collect()))),
        ])).collect();
        let sp = js::or(&s["SkinsPanelLayout"], js::obj());
        let mut daily: Vec<Value> = js::arr(&sp["SingleItemStoreOffers"]).iter().map(|o| def([
            ("id", g(o, "OfferID")), ("itemId", reward(o, "ItemID")), ("price", Some(first_value(&o["Cost"]).unwrap_or(Value::Null))),
        ])).collect();
        if daily.is_empty() && truthy(&sp["SingleItemOffers"]) {
            for id in js::arr(&sp["SingleItemOffers"]) { daily.push(json!({ "id": id, "itemId": id, "price": null })); }
        }
        let nm = &s["BonusStore"];
        let night = if truthy(nm) {
            def([
                ("secondsLeft", g(nm, "BonusStoreRemainingDurationInSeconds")),
                ("offers", Some(Value::Array(js::arr(&nm["BonusStoreOffers"]).iter().map(|o| def([
                    ("id", g(&o["Offer"], "OfferID")), ("itemId", reward(&o["Offer"], "ItemID")), ("base", first_value(&o["Offer"]["Cost"])),
                    ("price", first_value(&o["DiscountCosts"])), ("discount", g(o, "DiscountPercent")), ("revealed", Some(json!(truthy(&o["IsSeen"])))),
                ])).collect()))),
            ])
        } else { Value::Null };
        let acc = &s["AccessoryStore"];
        let accessories = if truthy(acc) {
            def([
                ("secondsLeft", g(acc, "AccessoryStoreRemainingDurationInSeconds")),
                ("offers", Some(Value::Array(js::arr(&acc["AccessoryStoreOffers"]).iter().map(|o| def([
                    ("id", g(&o["Offer"], "OfferID")), ("contractId", g(o, "ContractID")), ("itemId", reward(&o["Offer"], "ItemID")),
                    ("typeId", reward(&o["Offer"], "ItemTypeID")), ("price", first_value(&o["Offer"]["Cost"])),
                    ("currencyId", first_key(&o["Offer"]["Cost"])),
                ])).collect()))),
            ])
        } else { Value::Null };
        Ok(json!({
            "bundles": bundles, "daily": daily,
            "dailySecondsLeft": js::nullish(&sp["SingleItemOffersRemainingDurationInSeconds"], Value::Null),
            "night": night, "accessories": accessories,
        }))
    });

    // Current + peak rank.
    reg.add("store:rank", |ctx, _| async move {
        let m = ctx.riot.pd("get", &format!("mmr/v1/players/{}", ctx.riot.puuid()), None).await?;
        let seasons = &m["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"];
        let latest = &m["LatestCompetitiveUpdate"];
        let mut peak = 0f64;
        for (_, s) in js::entries(seasons) {
            for t in js_keys(&s["WinsByTier"]) { peak = max(peak, t.trim().parse::<f64>().unwrap_or(if t.trim().is_empty() { 0.0 } else { f64::NAN })); }
            peak = max(peak, js::num(&js::or(&s["CompetitiveTier"], json!(0))));
        }
        Ok(json!({
            "tier": js::nullish(&latest["TierAfterUpdate"], json!(0)), "rr": js::nullish(&latest["RankedRatingAfterUpdate"], json!(0)),
            "lastChange": js::nullish(&latest["RankedRatingEarned"], json!(0)), "peak": js::number(peak),
            "seasonId": js::or(&latest["SeasonID"], Value::Null),
        }))
    });

    // Equipped player card / title and account level for the dashboard hero.
    reg.add("store:identity", |ctx, _| async move {
        let p = ctx.riot.puuid();
        let mut l = ctx.riot.pd("get", &format!("personalization/v2/players/{p}/playerloadout"), None).await;
        if l.is_err() { l = ctx.riot.pd("get", &format!("personalization/v3/players/{p}/playerloadout"), None).await; }
        if l.is_err() { l = ctx.riot.pd("get", &format!("personalization/v1/players/{p}/playerloadout"), None).await; }
        let l = l?;
        let id = &l["Identity"];
        Ok(def([
            ("cardId", g(id, "PlayerCardID")), ("titleId", g(id, "PlayerTitleID")), ("level", g(id, "AccountLevel")),
            ("hideLevel", Some(json!(truthy(&id["HideAccountLevel"])))),
        ]))
    });
}
