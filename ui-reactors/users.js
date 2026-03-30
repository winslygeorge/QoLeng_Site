// users.js
import { 
  initializeStore, 
  registerReducer, 
  dispatch, 
  getState,
  subscribe 
} from '/static/assets/js/clientStore.js';

import { bindStateToDOM, initializeBindings } from '/static/assets/js/domBindings.js';

// Initial state for generic data handling and pagination demo
const initialState = {
  pageTitle: "Generic Reactive Store",
  inputModel: "",
  data: [
    { id: 1, name: "Item A" },
    { id: 2, name: "Item B" },
    { id: 3, name: "Item C" },
    { id: 4, name: "Item D" }
  ],
  __page: {
    data: 1
  },
  __perPage: {
    data: 2
  }
};

// Initialize the store with the initial state
initializeStore(initialState);

// --- Core Reducers ---

// Reducer for two-way data binding on input elements
registerReducer("__SET_MODEL", (state, action) => {
  const { key, value } = action;
  // console.log("Setting model:", key, value);
  return {
    ...state,
    [key]: value
  };
});

// Pagination: Move to the next page for a collection key
registerReducer("__PAGE_NEXT", (state, action) => {
  const { key } = action;
  const currentPage = state.__page?.[key] || 1;
  const items = state[key];
  
  if (!Array.isArray(items)) return state;
  
  const perPage = state.__perPage?.[key] || items.length;
  const totalPages = Math.ceil(items.length / perPage);
  const nextPage = currentPage < totalPages ? currentPage + 1 : currentPage;
  
  return {
    ...state,
    __page: {
      ...state.__page,
      [key]: nextPage
    }
  };
});

// Pagination: Move to the previous page for a collection key
registerReducer("__PAGE_PREV", (state, action) => {
  const { key } = action;
  const currentPage = state.__page?.[key] || 1;
  const prevPage = currentPage > 1 ? currentPage - 1 : 1;
  
  return {
    ...state,
    __page: {
      ...state.__page,
      [key]: prevPage
    }
  };
});

// Subscribe to store changes and update DOM
subscribe((state) => {
  bindStateToDOM(state, dispatch);
});

// Export for potential use elsewhere
export { getState, dispatch };

console.log("✅ Generic client store initialized");