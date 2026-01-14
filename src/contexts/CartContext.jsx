import { createContext, useContext, useState, useEffect } from 'react'
import { getOrganizerFees, calculateFees, DEFAULT_FEES } from '@/config/fees'
import { getPaymentProvider } from '@/config/payments'

const CartContext = createContext({})

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [fees, setFees] = useState(DEFAULT_FEES)
  const [loadingFees, setLoadingFees] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('ticketrack_cart')
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to parse cart from localStorage:', e)
      }
    }
  }, [])

  // Save cart to localStorage on changes
  useEffect(() => {
    localStorage.setItem('ticketrack_cart', JSON.stringify(items))
  }, [items])

  // Load fees when cart contents change
  useEffect(() => {
    loadCartFees()
  }, [items])

  const loadCartFees = async () => {
    if (items.length === 0) {
      setFees(DEFAULT_FEES)
      return
    }

    setLoadingFees(true)
    try {
      // Get fees based on the first event in cart (assuming single event per cart)
      const firstItem = items[0]
      if (firstItem.eventCurrency && firstItem.organizerId) {
        const eventFees = await getOrganizerFees(firstItem.organizerId, firstItem.eventCurrency)
        setFees(eventFees)
      } else {
        setFees(DEFAULT_FEES)
      }
    } catch (error) {
      console.error('Error loading cart fees:', error)
      setFees(DEFAULT_FEES)
    } finally {
      setLoadingFees(false)
    }
  }

  const addItem = (item) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.eventId === item.eventId && i.ticketTypeId === item.ticketTypeId
      )
      
      if (existingIndex > -1) {
        const updated = [...prev]
        updated[existingIndex].quantity += item.quantity
        return updated
      }
      
      return [...prev, { ...item, id: crypto.randomUUID() }]
    })
  }

  const removeItem = (itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }
    
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ))
  }

  const clearCart = () => {
    setItems([])
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  // Calculate fees using the same logic as checkout
  const paymentProvider = items.length > 0 && items[0].eventCurrency
    ? getPaymentProvider(items[0].eventCurrency)
    : 'paystack'

  const feeCalculation = calculateFees(subtotal, itemCount, fees, paymentProvider)
  const serviceFee = feeCalculation.displayFee // Combined service + processing fee
  const processingFee = feeCalculation.processingFee
  const platformFee = feeCalculation.serviceFee

  const total = subtotal + serviceFee

  const value = {
    items,
    itemCount,
    subtotal,
    serviceFee,
    processingFee,
    platformFee,
    total,
    fees,
    loadingFees,
    isOpen,
    setIsOpen,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    reloadFees: loadCartFees
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
