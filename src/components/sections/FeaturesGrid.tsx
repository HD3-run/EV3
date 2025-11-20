import { motion } from "framer-motion"
import { 
  ShoppingCart, 
  Package, 
  FileText, 
  RotateCcw, 
  BarChart3, 
  Share2, 
  Upload, 
  CreditCard, 
  Bell, 
  Users, 
  Download, 
  Zap,
  Search,
  Globe,
  UserCircle
} from "lucide-react"

const features = [
  { 
    icon: ShoppingCart, 
    title: "Multi-Channel Order Management", 
    question: "How do I manage orders from Phone, Email, Catalog, and Manual sources in one place?",
    description: "Unified order management across all channels with real-time status tracking, payment processing, and automated workflows. Never miss an order again.",
    color: "from-blue-500 to-cyan-500" 
  },
  { 
    icon: Package, 
    title: "Real-Time Inventory Tracking", 
    question: "How do I know my exact stock levels across all products?",
    description: "Track inventory in real-time with automatic stock updates, low stock alerts, and comprehensive product management. Stay ahead of stockouts.",
    color: "from-emerald-500 to-green-500" 
  },
  { 
    icon: FileText, 
    title: "Automated Invoice Generation", 
    question: "How do I generate professional invoices instantly with GST calculations?",
    description: "Auto-generate PDF invoices with GST compliance, delivery placeholders, and complete order history. Get paid faster with professional invoices.",
    color: "from-purple-500 to-violet-500" 
  },
  { 
    icon: RotateCcw, 
    title: "Returns & Refunds Management", 
    question: "How do I handle product returns and process refunds efficiently?",
    description: "Streamlined return processing with item tracking, refund management, and automated inventory updates. Turn returns into opportunities.",
    color: "from-red-500 to-pink-500" 
  },
  { 
    icon: BarChart3, 
    title: "Business Intelligence & Analytics", 
    question: "How do I understand my business performance and make data-driven decisions?",
    description: "Real-time dashboards with KPIs, profit margins, channel analytics, and comprehensive reports. Know your numbers, grow your business.",
    color: "from-amber-500 to-orange-500" 
  },
  { 
    icon: Share2, 
    title: "Shareable Product Catalogs", 
    question: "How do I share my product catalog with customers without a website?",
    description: "Create beautiful, shareable product catalogs with public links. Customers can browse, add to cart, and place orders directly. No website needed.",
    color: "from-indigo-500 to-blue-500" 
  },
  { 
    icon: Upload, 
    title: "Bulk Order Processing", 
    question: "How do I process hundreds of orders quickly without manual entry?",
    description: "Upload CSV files with bulk orders, automatic product matching, stock validation, and batch processing. Scale your operations effortlessly.",
    color: "from-teal-500 to-cyan-500" 
  },
  { 
    icon: CreditCard, 
    title: "Payment Tracking & Reconciliation", 
    question: "How do I track which orders are paid and manage payment status?",
    description: "Real-time payment tracking with multiple payment methods, payment history, and automatic invoice generation on payment. Never lose track of money.",
    color: "from-green-500 to-emerald-500" 
  },
  { 
    icon: Bell, 
    title: "Smart Stock Alerts", 
    question: "How do I know when products are running low before I run out?",
    description: "Automated low stock alerts with reorder level tracking. Get notified before stockouts happen and maintain optimal inventory levels.",
    color: "from-yellow-500 to-amber-500" 
  },
  { 
    icon: Users, 
    title: "Team & Role Management", 
    question: "How do I manage my team with different access levels and permissions?",
    description: "Role-based access control for admins, managers, and employees. Secure team collaboration with isolated data and customizable permissions.",
    color: "from-pink-500 to-rose-500" 
  },
  { 
    icon: Download, 
    title: "Data Export & Reporting", 
    question: "How do I export my data for analysis in Excel, CSV, or PDF formats?",
    description: "Export orders, inventory, and reports in multiple formats. Generate comprehensive reports for accounting, analysis, and compliance needs.",
    color: "from-violet-500 to-purple-500" 
  },
  { 
    icon: Zap, 
    title: "Real-Time Synchronization", 
    question: "How do I get instant updates across all devices and team members?",
    description: "WebSocket-powered real-time updates for orders, inventory, and payments. See changes instantly across all devices. No refresh needed.",
    color: "from-cyan-500 to-blue-500" 
  },
  { 
    icon: Search, 
    title: "Advanced Search & Filtering", 
    question: "How do I quickly find specific orders, products, or customers?",
    description: "Powerful search and filtering across orders, inventory, and customers. Find what you need instantly with smart filters and sorting options.",
    color: "from-slate-500 to-gray-500" 
  },
  { 
    icon: Globe, 
    title: "India-First Solutions", 
    question: "How do I manage GST, Indian addresses, and local payment methods?",
    description: "Built for Indian businesses with GST compliance, pincode-based address management, Indian phone number validation, and local payment support.",
    color: "from-orange-500 to-red-500" 
  },
  { 
    icon: UserCircle, 
    title: "Customer Relationship Management", 
    question: "How do I track customer information, order history, and build lasting relationships?",
    description: "Complete customer database with contact details, order history, address management, and purchase patterns. Build loyalty with better customer insights.",
    color: "from-blue-600 to-indigo-600" 
  },
]

export default function FeaturesGrid() {
  return (
    <section id="features" className="py-24 md:py-32 bg-gradient-to-br from-surface-900 to-surface-800 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-500/5 to-brand-accent-500/5" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">POWERFUL FEATURES FOR</span>
            <br />
            <span className="bg-gradient-to-r from-brand-primary-500 to-brand-accent-500 bg-clip-text text-transparent">MODERN E-COMMERCE</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Everything you need to manage orders, inventory, and logistics at scale
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50, rotateX: -8 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: index * 0.05 }}
              viewport={{ once: true }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="relative group bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-md border border-white/10 rounded-card p-8 hover:border-white/20 transition-all duration-500"
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-5 shadow-brand`}>
                <feature.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400 mb-3 italic font-medium">{feature.question}</p>
              <p className="text-slate-300 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
