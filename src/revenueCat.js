import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

let configuredUserId = '';
let configurationPromise = null;
let cachedMonthlyPackage = null;

export const revenueCatConfig = {
  iosApiKey: import.meta.env.VITE_REVENUECAT_IOS_API_KEY || 'appl_YMfeRvFoCfgIxAuTsqJVayljlkv',
  entitlementId: import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'The Complete Athlete Pro',
  premiumRequired: import.meta.env.VITE_PREMIUM_REQUIRED === 'true'
};

export function canUseNativePurchases() {
  return Boolean(Capacitor?.isNativePlatform?.()) && Capacitor.getPlatform?.() === 'ios';
}

function simplifyCustomerInfo(customerInfo, entitlementId = revenueCatConfig.entitlementId) {
  const activeEntitlements = customerInfo?.entitlements?.active ?? {};
  const entitlement =
    activeEntitlements[entitlementId] ??
    activeEntitlements.premium ??
    activeEntitlements['The Complete Athlete Pro'] ??
    Object.values(activeEntitlements)[0] ??
    null;
  return {
    active: Boolean(entitlement?.isActive),
    entitlement,
    expirationDate: entitlement?.expirationDate ?? customerInfo?.latestExpirationDate ?? '',
    managementURL: customerInfo?.managementURL ?? ''
  };
}

async function configurePurchases({ userId, email, name }) {
  if (!canUseNativePurchases()) return false;
  if (!revenueCatConfig.iosApiKey) throw new Error('RevenueCat key is not set yet.');

  const appUserID = userId ? String(userId) : null;
  if (configurationPromise && configuredUserId === appUserID) return configurationPromise;

  configuredUserId = appUserID;
  configurationPromise = (async () => {
    await Purchases.configure({
      apiKey: revenueCatConfig.iosApiKey,
      appUserID
    });
    if (email) await Purchases.setEmail({ email });
    if (name) await Purchases.setDisplayName({ displayName: name });
    return true;
  })();

  return configurationPromise;
}

function selectPackage(offerings) {
  const current = offerings?.current;
  return current?.monthly ?? current?.availablePackages?.[0] ?? null;
}

function packageSummary(selectedPackage) {
  if (!selectedPackage) return null;
  const product = selectedPackage.product ?? {};
  return {
    identifier: selectedPackage.identifier,
    productIdentifier: product.identifier || '',
    title: product.title || 'The Complete Athlete Premium',
    price: product.priceString || '$5.99',
    description: product.description || 'Full access to The Complete Athlete.'
  };
}

export async function loadRevenueCatSubscription({ userId, email, name }) {
  if (!revenueCatConfig.iosApiKey) {
    return {
      configured: false,
      native: canUseNativePurchases(),
      active: false,
      package: null,
      message: 'RevenueCat key is not set yet.'
    };
  }

  if (!canUseNativePurchases()) {
    return {
      configured: true,
      native: false,
      active: false,
      package: {
        identifier: 'monthly',
        productIdentifier: 'The_complete_athlete_monthly',
        title: 'The Complete Athlete Premium',
        price: '$5.99',
        description: 'Full access to The Complete Athlete.'
      },
      message: 'Purchases are handled by Apple inside the iPhone app.'
    };
  }

  await configurePurchases({ userId, email, name });
  const [{ customerInfo }, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings()
  ]);
  cachedMonthlyPackage = selectPackage(offerings);
  const status = simplifyCustomerInfo(customerInfo);

  return {
    configured: true,
    native: true,
    ...status,
    package: packageSummary(cachedMonthlyPackage),
    message: cachedMonthlyPackage
      ? status.active
        ? 'Premium access is active.'
        : ''
      : 'The monthly subscription is still finishing setup in App Store Connect.'
  };
}

export async function purchaseRevenueCatSubscription() {
  if (!canUseNativePurchases()) throw new Error('Purchases are handled by Apple inside the iPhone app.');
  const selectedPackage = cachedMonthlyPackage ?? selectPackage(await Purchases.getOfferings());
  if (!selectedPackage) throw new Error('The monthly subscription is still finishing setup in App Store Connect.');
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: selectedPackage });
  return simplifyCustomerInfo(customerInfo);
}

export async function restoreRevenueCatSubscription() {
  if (!canUseNativePurchases()) throw new Error('Purchases are handled by Apple inside the iPhone app.');
  const { customerInfo } = await Purchases.restorePurchases();
  return simplifyCustomerInfo(customerInfo);
}
