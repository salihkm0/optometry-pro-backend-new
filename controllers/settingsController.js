const Shop = require('../models/Shop');
const User = require('../models/User');

// @desc    Get shop settings
// @route   GET /api/shops/:id/settings
// @access  Private
exports.getShopSettings = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: 'Shop not found' 
      });
    }

    // Check if user has access to this shop
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      if (shop._id.toString() !== req.user.shop?.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to access this shop' 
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        shop: {
          id: shop._id,
          name: shop.name,
          contact: shop.contact,
          logo: shop.logo,
          settings: shop.settings,
          isActive: shop.isActive,
          subscription: shop.subscription
        }
      }
    });
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Update shop settings
// @route   PUT /api/shops/:id/settings
// @access  Private
exports.updateShopSettings = async (req, res) => {
  try {
    const { name, contact, settings, logo } = req.body;
    
    let shop = await Shop.findById(req.params.id);
    
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: 'Shop not found' 
      });
    }

    // Check if user has permission to update this shop
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      if (shop._id.toString() !== req.user.shop?.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to update this shop' 
        });
      }
      
      // Shop owners and staff can only update specific fields
      const updateFields = {};
      if (name) updateFields.name = name;
      if (contact) updateFields.contact = contact;
      if (settings) updateFields.settings = settings;
      if (logo !== undefined) updateFields.logo = logo;
      
      shop = await Shop.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true, runValidators: true }
      );
    } else {
      // Admins can update all fields
      shop = await Shop.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Shop settings updated successfully',
      data: shop
    });
  } catch (error) {
    console.error('Error updating shop settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Get admin settings
// @route   GET /api/admin/settings
// @access  Private/Admin
exports.getAdminSettings = async (req, res) => {
  try {
    // This would typically come from a separate AdminSettings model
    // For now, return default settings
    const defaultSettings = {
      appName: 'Optometry Pro',
      timezone: 'America/New_York',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      defaultSubscription: 'free',
      autoActivateShops: true,
      sendWelcomeEmail: true,
      notifyNewShop: true,
      notifySubscriptionExpiry: true,
      dailyReports: false,
      trialPeriod: 14,
      gracePeriod: 7,
      autoRenew: 'enabled'
    };

    res.status(200).json({
      success: true,
      data: defaultSettings
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Update admin settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
exports.updateAdminSettings = async (req, res) => {
  try {
    // In a real application, you would save these to a database
    // For now, just return success
    
    res.status(200).json({
      success: true,
      message: 'Admin settings updated successfully',
      data: req.body
    });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};