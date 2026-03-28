// ---------- Age bucket display mapping ----------
const AGE_BUCKET_LABEL = {
  1: "<20",
  2: "20-25",
  3: "25-30",
  4: "30-35",
  5: "35-40",
  6: "40-45",
  7: "45-50",
  8: "50-55",
  9: "55-65",
  10: "65+"
}
const ageLabel = (bucket) => AGE_BUCKET_LABEL[bucket] ?? String(bucket)

// ---------- helpers ----------
const normalize = (v) => (v == null ? "" : String(v).trim())
const uniq = (arr) => Array.from(new Set(arr))
const sortStrings = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })

// ---------- Static hair categories (canonical display order) ----------
const STATIC_HAIR_CATEGORIES = ["bald", "black", "blonde", "brown", "colored", "gray/white", "red"]

const hairToBuckets = (raw) => {
  const normalized = normalize(raw).toLowerCase()
  if (!normalized) return []

  const found = new Set()

  for (const canonical of STATIC_HAIR_CATEGORIES) {
    const parts = canonical.split("/")
    if (parts.some(part => normalized.includes(part))) {
      found.add(canonical)
    }
  }

  if (found.size === 0) found.add(normalized)

  return Array.from(found)
}

// ---------- Static ethnicity categories (canonical display order) ----------
const STATIC_ETHNICITY_CATEGORIES = [
  "aborigine", "arabic", "biracial", "black", "chinese", "filipino",
  "indian", "indigenous na", "israeli", "japanese", "korean", "latinx", "white"
]

const ETHNICITY_PART_OVERRIDES = {
  "indigenous na": ["indigenous", "native"]
}

const ethnicityToBuckets = (raw) => {
  const normalized = normalize(raw).toLowerCase()
  if (!normalized) return []

  const found = new Set()

  for (const canonical of STATIC_ETHNICITY_CATEGORIES) {
    const parts = ETHNICITY_PART_OVERRIDES[canonical] ?? canonical.split("/")
    if (parts.some(part => normalized.includes(part))) {
      found.add(canonical)
    }
  }

  if (found.size === 0) found.add(normalized)

  return Array.from(found)
}

// ---------- mount points ----------
const facesContainer = document.getElementById("facesContainer")
if (!facesContainer) throw new Error("Missing #facesContainer in DOM")

// ---------- sanitize faces input ----------
const safeFaces = Array.isArray(faces) ? faces.filter(Boolean) : []
if (safeFaces.length === 0) console.warn("faces is empty or not an array")

// ---------- build cards ----------
const makeFaceCard = (face, index) => {
  if (!face || typeof face !== "object") return null

  const name = normalize(face.name).replace(/\b\w+/g, w =>
  w.toLowerCase()
)

  const ageBucketNum = Number(face.age)
  const ageBucket = Number.isFinite(ageBucketNum) ? ageBucketNum : null

  const ethnicityRaw = normalize(face.ethnicity).toLowerCase()
  const ethnicityBuckets = ethnicityToBuckets(ethnicityRaw)
  const hairRaw = normalize(face.hair).toLowerCase()
  const hairBuckets = hairToBuckets(hairRaw)
  const category = normalize(face.category).toLowerCase()
  const type = normalize(face.type).toLowerCase()

  const imageURL = normalize(face.imageURL)
  const resourceURL = normalize(face.resourceURL)

  const card = resourceURL ? document.createElement("a") : document.createElement("div")
  card.className = "face-card"

  if (resourceURL) {
    card.href = resourceURL
    card.target = "_blank"
    card.rel = "noopener noreferrer"
    card.dataset.resourceURL = resourceURL
  }

  card.dataset.name = name
  card.dataset.age = ageBucket == null ? "" : String(ageBucket)
  card.dataset.ethnicity = ethnicityBuckets.join("|")
  card.dataset.hair = hairBuckets.join("|")
  card.dataset.category = category
  card.dataset.type = type
  card.dataset.hasImage = imageURL ? "1" : "0"
  card.dataset.hasRef = resourceURL ? "1" : "0"
  card.dataset.favorite = "0"
  card.dataset.pinned = "0"
  card.dataset.index = String(index)

  const img = document.createElement("img")
  img.src = imageURL
  img.alt = name
  img.loading = "lazy"
  img.decoding = "async"

  const nameEl = document.createElement("div")
  nameEl.className = "name"
  nameEl.textContent = name

  const heartBtn = document.createElement("button")
  heartBtn.className = "favorite-btn"
  heartBtn.setAttribute("aria-label", "Toggle favorite")
  heartBtn.textContent = "♡"
  heartBtn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    const isFav = card.dataset.favorite === "1"
    card.dataset.favorite = isFav ? "0" : "1"
    heartBtn.textContent = isFav ? "♡" : "♥"
    heartBtn.classList.toggle("is-favorited", !isFav)
    saveFavorites()
    applyFilters()
  })

  card.append(img, nameEl, heartBtn)
  return card
}

const cards = safeFaces
  .slice()
  .sort((a, b) => normalize(a?.name).localeCompare(normalize(b?.name), undefined, { sensitivity: "base" }))
  .map(makeFaceCard)
  .filter((el) => el instanceof Element)

facesContainer.append(...cards)

// ---------- filtering state ----------
const filters = {
  age: new Set(),
  ethnicity: new Set(),
  hair: new Set(),
  type: new Set(),
  category: new Set(),
  nonWhite: false,
  noImage: false,
  noRef: false
}

// ---------- favorites persistence ----------
const saveFavorites = () => {
  const favNames = cards
    .filter(c => c.dataset.favorite === "1")
    .map(c => c.dataset.name)
  localStorage.setItem("facesFavorites", JSON.stringify(favNames))
}

const loadFavorites = () => {
  try {
    const raw = localStorage.getItem("facesFavorites")
    if (!raw) return
    const favNames = new Set(JSON.parse(raw))
    for (const card of cards) {
      if (favNames.has(card.dataset.name)) {
        card.dataset.favorite = "1"
        const btn = card.querySelector(".favorite-btn")
        if (btn) {
          btn.textContent = "♥"
          btn.classList.add("is-favorited")
        }
      }
    }
  } catch {
    localStorage.removeItem("facesFavorites")
  }
}

// ---------- filter persistence ----------
const saveFilters = () => {
  const serialized = {
    age: Array.from(filters.age),
    ethnicity: Array.from(filters.ethnicity),
    hair: Array.from(filters.hair),
    type: Array.from(filters.type),
    category: Array.from(filters.category),
    nonWhite: filters.nonWhite,
    noImage: filters.noImage,
    noRef: filters.noRef
  }
  localStorage.setItem("facesFilters", JSON.stringify(serialized))
}

const loadFilters = () => {
  try {
    const raw = localStorage.getItem("facesFilters")
    if (!raw) return
    const saved = JSON.parse(raw)
    if (saved.age) saved.age.forEach(v => filters.age.add(v))
    if (saved.ethnicity) saved.ethnicity.forEach(v => filters.ethnicity.add(v))
    if (saved.hair) saved.hair.forEach(v => filters.hair.add(v))
    if (saved.type) saved.type.forEach(v => filters.type.add(v))
    if (saved.category) saved.category.forEach(v => filters.category.add(v))
    filters.nonWhite = saved.nonWhite ?? false
    filters.noImage = saved.noImage ?? false
    filters.noRef = saved.noRef ?? false
  } catch {
    localStorage.removeItem("facesFilters")
  }
}

// ---------- dev filter UI ----------
const buildDevFilters = () => {
  const mount = document.getElementById("filterDev")
  if (!mount) return

  const noImageCount = cards.filter(c => c.dataset.hasImage === "0").length
  const noRefCount = cards.filter(c => c.dataset.hasRef === "0").length

  mount.innerHTML = ""

  if (noImageCount > 0) {
    const label = document.createElement("label")
    label.className = "filter-option"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.id = "devFilterNoImage"
    input.addEventListener("change", () => {
      filters.noImage = input.checked
      applyFilters()
    })
    const text = document.createElement("span")
    text.textContent = `no images (${noImageCount})`
    label.append(input, text)
    mount.appendChild(label)
  }

  if (noRefCount > 0) {
    const label = document.createElement("label")
    label.className = "filter-option"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.id = "devFilterNoRef"
    input.addEventListener("change", () => {
      filters.noRef = input.checked
      applyFilters()
    })
    const text = document.createElement("span")
    text.textContent = `no refs (${noRefCount})`
    label.append(input, text)
    mount.appendChild(label)
  }
}

// ---------- count updates ----------
const updateCounts = () => {
  const visibleCards = cards.filter(c => !c.classList.contains("is-hidden"))

  // Type counts (always show)
  for (const input of document.querySelectorAll("#filterType input[type='checkbox']")) {
    const val = input.value
    const count = visibleCards.filter(c =>
      c.dataset.type === "both" || c.dataset.type === val
    ).length
    const span = input.closest("label")?.querySelector("span")
    if (span) span.textContent = `${span.textContent.replace(/ \(\d+\)$/, "")} (${count})`
  }

  // Age counts (always show)
  for (const input of document.querySelectorAll("#filterAge input[type='checkbox']")) {
    const val = input.value
    const count = visibleCards.filter(c => c.dataset.age === val).length
    const span = input.closest("label")?.querySelector("span")
    if (span) span.textContent = `${ageLabel(Number(val))} (${count})`
  }

  // Ethnicity counts (hide label if 0)
  for (const input of document.querySelectorAll("#filterEthnicity input[type='checkbox']")) {
    if (input.id === "filterNonWhite") {
      const count = visibleCards.filter(c => c.dataset.ethnicity.split("|").some(b => b !== "white")).length
      const label = input.closest("label")
      const span = label?.querySelector("span")
      if (span) span.textContent = `Non-White (${count})`
      if (label) label.style.display = count === 0 && !input.checked ? "none" : ""
      continue
    }
    const val = input.value
    const count = visibleCards.filter(c => c.dataset.ethnicity.split("|").includes(val)).length
    const label = input.closest("label")
    const span = label?.querySelector("span")
    if (span) span.textContent = `${val.replace(/\b\w/g, c => c.toUpperCase())} (${count})`
    if (label) label.style.display = count === 0 && !input.checked ? "none" : ""
  }

  // Hair counts (hide label if 0)
  for (const input of document.querySelectorAll("#filterHair input[type='checkbox']")) {
    const val = input.value
    const count = visibleCards.filter(c => c.dataset.hair.split("|").includes(val)).length
    const label = input.closest("label")
    const span = label?.querySelector("span")
    if (span) span.textContent = `${val.replace(/\b\w/g, c => c.toUpperCase())} (${count})`
    if (label) label.style.display = count === 0 && !input.checked ? "none" : ""
  }
}

// ---------- apply filters ----------
const noResultsEl = document.getElementById("noResults")

const applyFilters = () => {
  let visibleCount = 0

  for (const card of cards) {
    const isFavorite = card.dataset.favorite === "1"

    const okCategory =
      filters.category.size === 0 ||
      filters.category.has(card.dataset.category)

    // Favorites only respect the category toggle
    if (isFavorite && okCategory) {
      card.classList.remove("is-hidden")
      card.dataset.pinned = "1"
      visibleCount++
      continue
    }

    card.dataset.pinned = "0"

    const okType =
      filters.type.size === 0 ||
      card.dataset.type === "both" ||
      filters.type.has(card.dataset.type)

    const okAge =
      filters.age.size === 0 ||
      filters.age.has(card.dataset.age)

    const ethnicityBuckets = card.dataset.ethnicity.split("|")

    const okEthnicity =
      filters.ethnicity.size === 0 ||
      ethnicityBuckets.some(b => filters.ethnicity.has(b))

    const okNonWhite =
      !filters.nonWhite ||
      ethnicityBuckets.some(b => b !== "white")

    const okHair =
      filters.hair.size === 0 ||
      card.dataset.hair.split("|").some(b => filters.hair.has(b))

    const okNoImage = !filters.noImage || card.dataset.hasImage === "0"
    const okNoRef = !filters.noRef || card.dataset.hasRef === "0"

    const visible = okType && okCategory && okAge && okEthnicity && okNonWhite && okHair && okNoImage && okNoRef

    card.classList.toggle("is-hidden", !visible)
    if (visible) visibleCount++
  }

  if (noResultsEl) {
    noResultsEl.style.display = visibleCount === 0 ? "block" : "none"
  }

  // Re-order DOM: favorites (sorted alpha) first, then the rest
  const pinned = cards
    .filter(c => c.dataset.pinned === "1")
    .sort((a, b) => a.dataset.name.localeCompare(b.dataset.name, undefined, { sensitivity: "base" }))

  const unpinned = cards.filter(c => c.dataset.pinned !== "1")

  facesContainer.append(...pinned, ...unpinned)

  updateCounts()
  saveFilters()
}

// ---------- filter UI builders ----------
const buildCheckboxGroup = (mountId, key, values, labelFn = (v) => String(v)) => {
  const mount = document.getElementById(mountId)
  if (!mount) throw new Error(`Missing #${mountId} in DOM`)
  mount.innerHTML = ""

  for (const v of values) {
    const value = String(v)

    const label = document.createElement("label")
    label.className = "filter-option"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.value = value

    input.addEventListener("change", () => {
      if (input.checked) filters[key].add(value)
      else filters[key].delete(value)
      applyFilters()
    })

    const text = document.createElement("span")
    text.textContent = labelFn(v)

    label.append(input, text)
    mount.appendChild(label)
  }
}

// Type filter
const buildTypeFilter = () => {
  const mount = document.getElementById("filterType")
  if (!mount) throw new Error("Missing #filterType in DOM")
  mount.innerHTML = ""

  const options = [
    { value: "thot", label: "T.H.O.T" },
    { value: "not", label: "Not" }
  ]

  for (const opt of options) {
    const label = document.createElement("label")
    label.className = "filter-option"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.value = opt.value

    input.addEventListener("change", () => {
      if (input.checked) filters.type.add(input.value)
      else filters.type.delete(input.value)
      applyFilters()
    })

    const text = document.createElement("span")
    text.textContent = opt.label

    label.append(input, text)
    mount.appendChild(label)
  }
}

// Age filter — only shows buckets that exist for the active category
const buildAgeFilter = () => {
  const mount = document.getElementById("filterAge")
  if (!mount) throw new Error("Missing #filterAge in DOM")
  mount.innerHTML = ""

  const activeCategory = categoryToggle.checked ? CATEGORY_RIGHT : CATEGORY_LEFT

  const buckets = uniq(
    safeFaces
      .filter(f => normalize(f?.category).toLowerCase() === activeCategory)
      .map(f => Number(f?.age))
      .filter(Number.isFinite)
  ).sort((a, b) => a - b)

  for (const bucket of buckets) {
    const label = document.createElement("label")
    label.className = "filter-option"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.value = String(bucket)
    input.addEventListener("change", () => {
      if (input.checked) filters.age.add(input.value)
      else filters.age.delete(input.value)
      applyFilters()
    })

    const text = document.createElement("span")
    text.textContent = ageLabel(bucket)

    label.append(input, text)
    mount.appendChild(label)
  }
}

// Ethnicity filter
const buildEthnicityFilter = () => {
  const mount = document.getElementById("filterEthnicity")
  if (!mount) throw new Error("Missing #filterEthnicity in DOM")
  mount.innerHTML = ""

  const occupiedBuckets = new Set()
  for (const face of safeFaces) {
    for (const bucket of ethnicityToBuckets(normalize(face?.ethnicity))) {
      occupiedBuckets.add(bucket)
    }
  }

  for (const canonical of STATIC_ETHNICITY_CATEGORIES) {
    if (!occupiedBuckets.has(canonical)) continue

    const label = document.createElement("label")
    label.className = "filter-option"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.value = canonical

    input.addEventListener("change", () => {
      if (input.checked) filters.ethnicity.add(canonical)
      else filters.ethnicity.delete(canonical)
      applyFilters()
    })

    const text = document.createElement("span")
    text.textContent = canonical.replace(/\b\w/g, c => c.toUpperCase())

    label.append(input, text)
    mount.appendChild(label)
  }

  if (occupiedBuckets.has("white")) {
    const label = document.createElement("label")
    label.className = "filter-option"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.id = "filterNonWhite"
    input.addEventListener("change", () => {
      filters.nonWhite = input.checked
      applyFilters()
    })
    const text = document.createElement("span")
    text.textContent = "Non-White"
    label.append(input, text)
    mount.appendChild(label)
  }
}

// Hair filter
const buildHairFilter = () => {
  const mount = document.getElementById("filterHair")
  if (!mount) throw new Error("Missing #filterHair in DOM")
  mount.innerHTML = ""

  const occupiedBuckets = new Set()
  for (const face of safeFaces) {
    for (const bucket of hairToBuckets(normalize(face?.hair))) {
      occupiedBuckets.add(bucket)
    }
  }

  for (const canonical of STATIC_HAIR_CATEGORIES) {
    if (!occupiedBuckets.has(canonical)) continue

    const label = document.createElement("label")
    label.className = "filter-option"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.value = canonical

    input.addEventListener("change", () => {
      if (input.checked) filters.hair.add(canonical)
      else filters.hair.delete(canonical)
      applyFilters()
    })

    const text = document.createElement("span")
    text.textContent = canonical.replace(/\b\w/g, c => c.toUpperCase())

    label.append(input, text)
    mount.appendChild(label)
  }
}

const buildAllFilters = () => {
  buildDevFilters()
  buildTypeFilter()
  buildAgeFilter()
  buildEthnicityFilter()
  buildHairFilter()
}

// ---------- sync checkboxes to restored filter state ----------
const syncCheckboxesToFilters = () => {
  categoryToggle.checked = filters.category.has(CATEGORY_RIGHT)

  document.querySelectorAll(".faces-sidebar input[type='checkbox']").forEach(cb => {
    if (cb.id === "categoryToggle") return
    if (cb.id === "filterNonWhite") { cb.checked = filters.nonWhite; return }
    if (cb.id === "devFilterNoImage") { cb.checked = filters.noImage; return }
    if (cb.id === "devFilterNoRef") { cb.checked = filters.noRef; return }

    const groupId = cb.closest("[id]")?.id ?? ""
    const key = groupId.replace("filter", "").toLowerCase()
    if (filters[key] instanceof Set) {
      cb.checked = filters[key].has(cb.value)
    }
  })
}

// ---------- Category toggle: Masc <-> Femme ----------
const categoryToggle = document.getElementById("categoryToggle")
if (!categoryToggle) throw new Error("Missing #categoryToggle in DOM")

const CATEGORY_LEFT = "masc"
const CATEGORY_RIGHT = "femme"

categoryToggle.addEventListener("change", () => {
  filters.category.clear()
  filters.category.add(categoryToggle.checked ? CATEGORY_RIGHT : CATEGORY_LEFT)
  filters.age.clear()
  buildAgeFilter()
  applyFilters()
})

const toggleImagesBtn = document.getElementById("toggleImagesBtn")

let imagesHidden = false

toggleImagesBtn?.addEventListener("click", () => {
  imagesHidden = !imagesHidden
  document.body.classList.toggle("hide-images", imagesHidden)
  toggleImagesBtn.textContent = imagesHidden ? "Show Images" : "Hide Images"
})

// ---------- sorts ----------
const sortByAgeThenName = () => {
  cards.sort((a, b) => {
    const ageA = Number(a.dataset.age)
    const ageB = Number(b.dataset.age)

    const aBad = !Number.isFinite(ageA) || a.dataset.age === ""
    const bBad = !Number.isFinite(ageB) || b.dataset.age === ""
    if (aBad && !bBad) return 1
    if (!aBad && bBad) return -1

    if (ageA !== ageB) return ageA - ageB
    return a.dataset.name.localeCompare(b.dataset.name, undefined, { sensitivity: "base" })
  })

  facesContainer.append(...cards)
  applyFilters()
}

const sortByName = () => {
  cards.sort((a, b) =>
    a.dataset.name.localeCompare(b.dataset.name, undefined, { sensitivity: "base" })
  )

  facesContainer.append(...cards)
  applyFilters()
}

const resetOrder = () => {
  cards.sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
  facesContainer.append(...cards)
  applyFilters()
}

// ---------- Clear button ----------
document.getElementById("clearFiltersBtn").addEventListener("click", () => {
  filters.age.clear()
  filters.ethnicity.clear()
  filters.hair.clear()
  filters.type.clear()
  filters.nonWhite = false
  filters.noImage = false
  filters.noRef = false

  const nonWhiteInput = document.getElementById("filterNonWhite")
  if (nonWhiteInput) nonWhiteInput.checked = false

  const devNoImage = document.getElementById("devFilterNoImage")
  const devNoRef = document.getElementById("devFilterNoRef")
  if (devNoImage) devNoImage.checked = false
  if (devNoRef) devNoRef.checked = false

  filters.category.clear()
  filters.category.add(categoryToggle.checked ? CATEGORY_RIGHT : CATEGORY_LEFT)

  document
    .querySelectorAll(".faces-sidebar input[type='checkbox']")
    .forEach(cb => {
      if (cb.id === "categoryToggle") return
      cb.checked = false
    })

  localStorage.removeItem("facesFilters")
  applyFilters()
})

document.getElementById("sortAgeNameBtn")?.addEventListener("click", sortByAgeThenName)
document.getElementById("sortNameBtn")?.addEventListener("click", sortByName)
document.getElementById("resetOrderBtn")?.addEventListener("click", resetOrder)

// ---------- DEFAULTS ON LOAD ----------
loadFilters()
buildAllFilters()
loadFavorites()
syncCheckboxesToFilters()

if (!filters.category.size) {
  categoryToggle.checked = true
  filters.category.add(CATEGORY_RIGHT)
}

applyFilters()
