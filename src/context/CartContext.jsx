import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext({})

export const useCart = () => useContext(CartContext)

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('ticketrack_cart')
    return saved ? JSON.parse(saved) : { items: [], eventId: null }
  })

  useEffect(() => {
    localStorage.setItem('ticketrack_cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (eventId, eventDetails, ticketType, quantity) => {
    setCart(prev => {
      // If adding to a different event, clear cart first
      if (prev.eventId && prev.eventId !== eventId) {
        return {
          eventId,
          eventDetails,
          items: [{ ticketType, quantity }]
        }
      }

      const existingIndex = prev.items.findIndex(
        item => item.ticketType.id === ticketType.id
      )

      let newItems
      if (existingIndex >= 0) {
        newItems = prev.items.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      } else {
        newItems = [...prev.items, { ticketType, quantity }]
      }

      return {
        eventId,
        eventDetails: eventDetails || prev.eventDetails,
        items: newItems
      }
    })
  }

  const updateQuantity = (ticketTypeId, quantity) => {
    setCart(prev => ({
      ...prev,
      items: quantity > 0
        ? prev.items.map(item =>
            item.ticketType.id === ticketTypeId
              ? { ...item, quantity }
              : item
          )
        : prev.items.filter(item => item.ticketType.id !== ticketTypeId)
    }))
  }

  const removeFromCart = (ticketTypeId) => {
    setCart(prev => {
      const newItems = prev.items.filter(
        item => item.ticketType.id !== ticketTypeId
      )
      return {
        ...prev,
        items: newItems,
        eventId: newItems.length === 0 ? null : prev.eventId
      }
    })
  }

  const clearCart = () => {
    setCart({ items: [], eventId: null, eventDetails: null })
  }

  const getTotal = () => {
    return cart.items.reduce(
      (total, item) => total + item.ticketType.price * item.quantity,
      0
    )
  }

  const getTotalItems = () => {
    return cart.items.reduce((total, item) => total + item.quantity, 0)
  }

  const value = {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotal,
    getTotalItems
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}
