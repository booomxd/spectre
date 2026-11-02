// Storefront, wallet and rank snapshot for the dashboard and shop.
module.exports = ({ riot, handle }) => {
    const puuid = () => riot.state.puuid

    async function storefront() {
        try { return await riot.pd('post', `store/v3/storefront/${puuid()}`, {}) }
        catch (e) { return await riot.pd('get', `store/v2/storefront/${puuid()}`) }
    }

    handle('store:wallet', async () => {
        const w = await riot.pd('get', `store/v1/wallet/${puuid()}`)
        const b = w.Balances || {}
        return {
            vp: b['85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741'] ?? 0,
            rad: b['e59aa87c-4cbf-517a-5983-6e81511be9b7'] ?? 0,
            kc: b['85ca954a-41f2-ce94-9b45-8ca3dd39a00d'] ?? 0,
        }
    })

    handle('store:storefront', async () => {
        const s = await storefront()
        const bundles = (s.FeaturedBundle?.Bundles || (s.FeaturedBundle?.Bundle ? [s.FeaturedBundle.Bundle] : [])).map(b => ({
            id: b.DataAssetID,
            secondsLeft: b.DurationRemainingInSeconds,
            totalBase: b.TotalBaseCost?.['85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741'] ?? null,
            totalDiscounted: b.TotalDiscountedCost?.['85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741'] ?? null,
            discountPercent: b.TotalDiscountPercent || 0,
            wholesaleOnly: !!b.WholesaleOnly,
            items: (b.Items || []).map(i => ({
                id: i.Item.ItemID, typeId: i.Item.ItemTypeID, amount: i.Item.Amount,
                base: i.BasePrice, price: i.DiscountedPrice, discount: i.DiscountPercent,
            })),
        }))
        const sp = s.SkinsPanelLayout || {}
        const daily = (sp.SingleItemStoreOffers || []).map(o => ({
            id: o.OfferID, itemId: o.Rewards?.[0]?.ItemID, price: Object.values(o.Cost || {})[0] ?? null,
        }))
        if (!daily.length && sp.SingleItemOffers) sp.SingleItemOffers.forEach(id => daily.push({ id, itemId: id, price: null }))
        const nm = s.BonusStore
        const night = nm ? {
            secondsLeft: nm.BonusStoreRemainingDurationInSeconds,
            offers: (nm.BonusStoreOffers || []).map(o => ({
                id: o.Offer.OfferID, itemId: o.Offer.Rewards?.[0]?.ItemID, base: Object.values(o.Offer.Cost || {})[0],
                price: Object.values(o.DiscountCosts || {})[0], discount: o.DiscountPercent, revealed: !!o.IsSeen,
            })),
        } : null
        const acc = s.AccessoryStore
        const accessories = acc ? {
            secondsLeft: acc.AccessoryStoreRemainingDurationInSeconds,
            offers: (acc.AccessoryStoreOffers || []).map(o => ({
                id: o.Offer.OfferID, contractId: o.ContractID, itemId: o.Offer.Rewards?.[0]?.ItemID,
                typeId: o.Offer.Rewards?.[0]?.ItemTypeID, price: Object.values(o.Offer.Cost || {})[0],
                currencyId: Object.keys(o.Offer.Cost || {})[0],
            })),
        } : null
        return { bundles, daily, dailySecondsLeft: sp.SingleItemOffersRemainingDurationInSeconds ?? null, night, accessories }
    })

    // Current + peak rank.
    handle('store:rank', async () => {
        const m = await riot.pd('get', `mmr/v1/players/${puuid()}`)
        const seasons = m.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {}
        const latest = m.LatestCompetitiveUpdate
        let peak = 0
        for (const s of Object.values(seasons)) {
            for (const t of Object.keys(s.WinsByTier || {})) peak = Math.max(peak, +t)
            peak = Math.max(peak, s.CompetitiveTier || 0)
        }
        return {
            tier: latest?.TierAfterUpdate ?? 0, rr: latest?.RankedRatingAfterUpdate ?? 0,
            lastChange: latest?.RankedRatingEarned ?? 0, peak,
            seasonId: latest?.SeasonID || null,
        }
    })

    // Equipped player card / title and account level for the dashboard hero.
    handle('store:identity', async () => {
        const l = await riot.pd('get', `personalization/v2/players/${puuid()}/playerloadout`).catch(() => riot.pd('get', `personalization/v3/players/${puuid()}/playerloadout`)).catch(() => riot.pd('get', `personalization/v1/players/${puuid()}/playerloadout`))
        return { cardId: l.Identity?.PlayerCardID, titleId: l.Identity?.PlayerTitleID, level: l.Identity?.AccountLevel, hideLevel: !!l.Identity?.HideAccountLevel }
    })
}
