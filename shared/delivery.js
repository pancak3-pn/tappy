export const DELIVERY_FEES = Object.freeze({ Luzon:80, Visayas:100, Mindanao:120 })

const PROVINCES_BY_REGION = Object.freeze({
  Luzon:[
    'Abra','Albay','Apayao','Aurora','Bataan','Batanes','Batangas','Benguet','Bulacan','Cagayan',
    'Camarines Norte','Camarines Sur','Catanduanes','Cavite','Ifugao','Ilocos Norte','Ilocos Sur',
    'Isabela','Kalinga','La Union','Laguna','Marinduque','Masbate','Metro Manila','Mountain Province',
    'Nueva Ecija','Nueva Vizcaya','Occidental Mindoro','Oriental Mindoro','Palawan','Pampanga','Pangasinan',
    'Quezon','Quirino','Rizal','Romblon','Sorsogon','Tarlac','Zambales',
  ],
  Visayas:[
    'Aklan','Antique','Biliran','Bohol','Capiz','Cebu','Eastern Samar','Guimaras','Iloilo','Leyte',
    'Negros Occidental','Negros Oriental','Northern Samar','Samar','Siquijor','Southern Leyte',
  ],
  Mindanao:[
    'Agusan del Norte','Agusan del Sur','Basilan','Bukidnon','Camiguin','Cotabato','Davao de Oro',
    'Davao del Norte','Davao del Sur','Davao Occidental','Davao Oriental','Dinagat Islands',
    'Lanao del Norte','Lanao del Sur','Maguindanao del Norte','Maguindanao del Sur','Misamis Occidental',
    'Misamis Oriental','Sarangani','South Cotabato','Sultan Kudarat','Sulu','Surigao del Norte',
    'Surigao del Sur','Tawi-Tawi','Zamboanga del Norte','Zamboanga del Sur','Zamboanga Sibugay',
  ],
})

export const DELIVERY_PROVINCES = Object.freeze(
  Object.entries(PROVINCES_BY_REGION)
    .flatMap(([region, provinces]) => provinces.map(name => ({ name, region })))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const REGION_BY_PROVINCE = new Map(DELIVERY_PROVINCES.map(({ name, region }) => [name, region]))

export function getDeliveryRegion(province) {
  return REGION_BY_PROVINCE.get(province) || ''
}

export function getDeliveryFee(province) {
  const region = getDeliveryRegion(province)
  return region ? DELIVERY_FEES[region] : null
}
