import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { user } = useAuth();
  useTheme();
  const userRole = user?.role;
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [_showManageRoles, _setShowManageRoles] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    phone: '',
    role: '',
    password: ''
  });
  const [billingDetails, setBillingDetails] = useState({
    gst_number: '',
    pan_number: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_pincode: '',
    billing_country: 'India',
    bank_name: '',
    bank_account_number: '',
    ifsc_code: '',
    invoice_logo_url: '',
    invoice_prefix: 'INV-',
    state_code: '19'
  });
  const [billingLoading, setBillingLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState('');
  const [billingMessageType, setBillingMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    // Load user profile data on component mount
    const loadProfile = async () => {
      try {
        const response = await fetch(getApiUrl('/api/profile'), {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setProfile({
            name: data.username || '',
            email: data.email || '',
            phone: data.phone || ''
          });
        }
      } catch (error) {
        setMessage('Failed to load profile data');
      }
    };
    loadProfile();
    if (userRole === 'admin') {
      loadUsers();
      loadBillingDetails();
    }
  }, [userRole]);

  const loadUsers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/users'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      setMessage('Failed to load users');
    }
  };

  const loadBillingDetails = async () => {
    console.log('🔍 Frontend: Loading billing details...');
    try {
      const response = await fetch(getApiUrl('/api/billing-details'), {
        credentials: 'include'
      });
      
      console.log('📡 Frontend: Load response status:', response.status);
      console.log('📡 Frontend: Load response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Frontend: Load response data:', data);
        
        if (data.billingDetails) {
          console.log('✅ Frontend: Setting billing details from response');
          setBillingDetails({
            gst_number: data.billingDetails.gst_number || '',
            pan_number: data.billingDetails.pan_number || '',
            billing_address_line1: data.billingDetails.billing_address_line1 || '',
            billing_address_line2: data.billingDetails.billing_address_line2 || '',
            billing_city: data.billingDetails.billing_city || '',
            billing_state: data.billingDetails.billing_state || '',
            billing_pincode: data.billingDetails.billing_pincode || '',
            billing_country: data.billingDetails.billing_country || 'India',
            bank_name: data.billingDetails.bank_name || '',
            bank_account_number: data.billingDetails.bank_account_number || '',
            ifsc_code: data.billingDetails.ifsc_code || '',
            invoice_logo_url: data.billingDetails.invoice_logo_url || '',
            invoice_prefix: data.billingDetails.invoice_prefix || 'INV-',
            state_code: data.billingDetails.state_code || '19'
          });
        } else {
          console.log('📭 Frontend: No billing details found in response');
        }
      } else {
        console.log('❌ Frontend: Load request failed');
      }
    } catch (error) {
      console.log('❌ Frontend: Load error:', error);
      setMessage('Failed to load billing details');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number format
    const phoneRegex = /^[0-9]{10}$/;
    if (newUser.phone && !phoneRegex.test(newUser.phone)) {
      setMessage('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newUser)
      });
      
      if (response.ok) {
        setMessage('User added successfully!');
        setNewUser({ username: '', email: '', phone: '', role: 'Employee', password: '' });
        setShowAddUser(false);
        loadUsers();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Failed to add user';
        setMessage(errorMessage);
        console.error('User creation error:', errorMessage, errorData);
        // Show browser alert for user visibility
        alert(errorMessage);
      }
    } catch (error) {
      const errorMessage = 'Failed to add user. Please check your connection and try again.';
      setMessage(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setMessage('User removed successfully!');
        loadUsers();
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Failed to remove user');
      }
    } catch (error) {
      setMessage('Failed to remove user');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleBillingDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBillingDetails(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear any existing messages when user starts editing
    if (billingMessage) {
      setBillingMessage('');
      setBillingMessageType('');
    }

    // Auto-fill city and state when pincode is entered
    if (name === 'billing_pincode' && value.length === 6) {
      handlePincodeLookup(value);
    }
  };

  const handlePincodeLookup = async (pincode: string) => {
    if (pincode.length !== 6) return;
    
    setPincodeLoading(true);
    try {
      // Using a free Indian pincode API
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffice = data[0].PostOffice[0];
        
        // Create address line 1 from available post office data
        let addressLine1 = '';
        if (postOffice.Name && postOffice.Name !== postOffice.District) {
          // Use post office name as address line 1 if it's different from district
          addressLine1 = postOffice.Name;
        } else if (postOffice.Block && postOffice.Block !== postOffice.District) {
          // Use block name if post office name is same as district
          addressLine1 = postOffice.Block;
        } else if (postOffice.Division && postOffice.Division !== postOffice.District) {
          // Use division as fallback
          addressLine1 = postOffice.Division;
        }
        
        setBillingDetails(prev => ({
          ...prev,
          billing_city: postOffice.District || prev.billing_city,
          billing_state: postOffice.State || prev.billing_state,
          billing_country: 'India',
          billing_address_line1: addressLine1 || prev.billing_address_line1
        }));
        
        console.log('✅ Address auto-filled from pincode:', {
          city: postOffice.District,
          state: postOffice.State,
          addressLine1: addressLine1,
          postOfficeName: postOffice.Name,
          block: postOffice.Block,
          division: postOffice.Division
        });
      } else {
        console.log('❌ Pincode not found or invalid');
      }
    } catch (error) {
      console.log('❌ Pincode lookup failed:', error);
    } finally {
      setPincodeLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Using multiple geocoding services for better address details
          const [bigDataResponse, nominatimResponse] = await Promise.allSettled([
            // Primary service - BigDataCloud (good for city/state)
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`),
            // Secondary service - Nominatim (good for detailed address)
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`)
          ]);
          
          let addressData: any = {};
          let detailedAddress: any = {};
          
          // Process BigDataCloud response
          if (bigDataResponse.status === 'fulfilled' && bigDataResponse.value.ok) {
            const data = await bigDataResponse.value.json();
            addressData = {
              city: data.locality,
              state: data.principalSubdivision,
              country: data.countryName,
              pincode: data.postcode
            };
          }
          
          // Process Nominatim response for detailed address
          if (nominatimResponse.status === 'fulfilled' && nominatimResponse.value.ok) {
            const data = await nominatimResponse.value.json();
            detailedAddress = {
              address: data.display_name,
              houseNumber: data.address?.house_number || '',
              road: data.address?.road || '',
              suburb: data.address?.suburb || '',
              postcode: data.address?.postcode || '',
              city: data.address?.city || data.address?.town || data.address?.village,
              state: data.address?.state,
              country: data.address?.country
            };
          }
          
          // Combine data from both services
          const finalAddress = {
            billing_city: addressData.city || detailedAddress.city || '',
            billing_state: addressData.state || detailedAddress.state || '',
            billing_country: addressData.country || detailedAddress.country || 'India',
            billing_pincode: addressData.pincode || detailedAddress.postcode || '',
            billing_address_line1: detailedAddress.road ? 
              `${detailedAddress.houseNumber ? detailedAddress.houseNumber + ', ' : ''}${detailedAddress.road}`.trim() : 
              (detailedAddress.suburb || '')
          };
          
          // Only update if we got meaningful data
          if (finalAddress.billing_city || finalAddress.billing_state) {
            setBillingDetails(prev => ({
              ...prev,
              ...finalAddress
            }));
            
            console.log('✅ Location auto-filled:', finalAddress);
            
            // If we got a pincode, trigger pincode lookup for additional validation
            if (finalAddress.billing_pincode && finalAddress.billing_pincode.length === 6) {
              handlePincodeLookup(finalAddress.billing_pincode);
            }
          } else {
            setMessage('Could not determine address from current location');
          }
        } catch (error) {
          console.log('❌ Reverse geocoding failed:', error);
          setMessage('Failed to get address from location');
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        console.log('❌ Geolocation error:', error);
        setMessage('Failed to get current location');
        setLocationLoading(false);
      }
    );
  };

  const handleBillingDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 Frontend: Submitting billing details...');
    console.log('📋 Frontend: Billing details data:', JSON.stringify(billingDetails, null, 2));
    
    // Clear previous messages
    setBillingMessage('');
    setBillingMessageType('');
    
    setBillingLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/billing-details'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(billingDetails)
      });
      
      console.log('📡 Frontend: Response status:', response.status);
      console.log('📡 Frontend: Response ok:', response.ok);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Frontend: Success response:', responseData);
        
        // Show success message
        setBillingMessage('🎉 Billing details saved successfully! Your invoice settings are now configured.');
        setBillingMessageType('success');
        
        // Also update the general message for consistency
        setMessage('Billing details saved successfully!');
      } else {
        const errorData = await response.json();
        console.log('❌ Frontend: Error response:', errorData);
        
        // Show detailed error message
        let errorMessage = 'Failed to save billing details';
        if (errorData.message) {
          errorMessage = `❌ ${errorData.message}`;
          
          // Add specific guidance for common errors
          if (errorData.message.includes('GST number format')) {
            errorMessage += '\n\n💡 Tip: GST number should be 15 characters like: 22AAAAA0000A1Z5';
          } else if (errorData.message.includes('PAN number format')) {
            errorMessage += '\n\n💡 Tip: PAN number should be 10 characters like: AAAAA0000A';
          } else if (errorData.message.includes('IFSC code format')) {
            errorMessage += '\n\n💡 Tip: IFSC code should be 11 characters like: SBIN0001234';
          } else if (errorData.message.includes('required')) {
            errorMessage += '\n\n💡 Tip: Please fill in all required fields (Address Line 1, City, State, Pincode)';
          }
        }
        
        setBillingMessage(errorMessage);
        setBillingMessageType('error');
        
        // Also update the general message
        setMessage(errorData.message || 'Failed to save billing details');
      }
    } catch (error) {
      console.log('❌ Frontend: Network error:', error);
      
      // Show network error message
      setBillingMessage('❌ Network error: Unable to connect to server. Please check your internet connection and try again.');
      setBillingMessageType('error');
      
      setMessage('Failed to save billing details');
    } finally {
      setBillingLoading(false);
      
      // Auto-clear messages after 5 seconds
      setTimeout(() => {
        setBillingMessage('');
        setBillingMessageType('');
        setMessage('');
      }, 5000);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // For phone field, only allow numeric characters
    if (name === 'phone') {
      const numericValue = value.replace(/\D/g, ''); // Remove all non-numeric characters
      setProfile(prevProfile => ({
        ...prevProfile,
        [name]: numericValue,
      }));
    } else {
      setProfile(prevProfile => ({
        ...prevProfile,
        [name]: value,
      }));
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number format
    const phoneRegex = /^[0-9]{10}$/;
    if (profile.phone && !phoneRegex.test(profile.phone)) {
      setMessage('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(profile)
      });
      
      if (response.ok) {
        setMessage('Profile updated successfully!');
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      setMessage('Failed to update profile');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const validatePasswordComplexity = (password: string): string[] => {
    const errors = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain lowercase letter');
    if (!/\d/.test(password)) errors.push('Password must contain number');
    if (!/[!@#$%^&*]/.test(password)) errors.push('Password must contain special character (!@#$%^&*)');
    return errors;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password complexity
    const errors = validatePasswordComplexity(newPassword);
    if (errors.length > 0) {
      setPasswordErrors(errors);
      setMessage('Password requirements not met');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setMessage('New passwords do not match.');
      setPasswordErrors([]);
      return;
    }
    
    setPasswordErrors([]);
    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/profile/password'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      if (response.ok) {
        setMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Failed to change password');
      }
    } catch (error) {
      setMessage('Failed to change password');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-light-pink dark:bg-gray-900 text-gray-900 dark:text-white">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">{userRole === 'admin' ? 'Merchant Profile / Settings' : 'User Profile / Settings'}</h1>

      {message && <div className="bg-blue-100 text-blue-800 p-3 rounded-md mb-4">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Profile Settings */}
        <div className="bg-light-pink-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Edit Profile</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={profile.name}
                onChange={handleProfileChange}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={profile.email}
                onChange={handleProfileChange}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={profile.phone}
                onChange={handleProfileChange}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Enter phone number"
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-light-pink-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-1">Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Minimum 8 characters</li>
                  <li>At least 1 uppercase letter</li>
                  <li>At least 1 lowercase letter</li>
                  <li>At least 1 number</li>
                  <li>At least 1 special character (!@#$%^&*)</li>
                </ul>
              </div>
              {passwordErrors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {passwordErrors.map((error, index) => (
                    <p key={index}>• {error}</p>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
              <input
                type="password"
                id="confirmNewPassword"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Billing Details (Admin only) */}
        {userRole === 'admin' && (
          <div className="bg-light-pink-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md col-span-full">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Billing Details</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">Configure your business billing information for invoice generation.</p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Smart Address Features:</h4>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• <strong>📍 Use Current Location:</strong> Auto-detect complete address including street, pincode, city, and state</li>
                <li>• <strong>🔢 Enter Pincode:</strong> Auto-fill complete address including area, city, and state from Indian postal codes</li>
                <li>• <strong>✅ Real Validation:</strong> Only valid Indian addresses are accepted</li>
              </ul>
            </div>
            
            {/* Billing Details Messages */}
            {billingMessage && (
              <div className={`p-4 rounded-lg mb-6 ${
                billingMessageType === 'success' 
                  ? 'bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200' 
                  : 'bg-red-100 border border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {billingMessageType === 'success' ? (
                      <span className="text-green-500 text-xl">✅</span>
                    ) : (
                      <span className="text-red-500 text-xl">❌</span>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <pre className="whitespace-pre-wrap text-sm font-medium">
                      {billingMessage}
                    </pre>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => {
                        setBillingMessage('');
                        setBillingMessageType('');
                      }}
                      className={`inline-flex rounded-md p-1.5 ${
                        billingMessageType === 'success'
                          ? 'text-green-500 hover:bg-green-200 dark:hover:bg-green-800'
                          : 'text-red-500 hover:bg-red-200 dark:hover:bg-red-800'
                      }`}
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleBillingDetailsSubmit} className="space-y-6">
              {/* Business Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    GST Number (Optional)
                  </label>
                  <input
                    type="text"
                    name="gst_number"
                    value={billingDetails.gst_number}
                    onChange={handleBillingDetailsChange}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">15-character GST number (e.g., 22AAAAA0000A1Z5)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    PAN Number (Optional)
                  </label>
                  <input
                    type="text"
                    name="pan_number"
                    value={billingDetails.pan_number}
                    onChange={handleBillingDetailsChange}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">10-character PAN number (e.g., AAAAA0000A)</p>
                </div>
              </div>

              {/* Billing Address */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">Billing Address</h3>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={locationLoading}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {locationLoading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Detecting...
                      </>
                    ) : (
                      <>
                        📍 Use Current Location
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Address Line 1 *
                    </label>
                    <input
                      type="text"
                      name="billing_address_line1"
                      value={billingDetails.billing_address_line1}
                      onChange={handleBillingDetailsChange}
                      placeholder="Street address, building name"
                      required
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      name="billing_address_line2"
                      value={billingDetails.billing_address_line2}
                      onChange={handleBillingDetailsChange}
                      placeholder="Apartment, suite, unit, etc."
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      name="billing_city"
                      value={billingDetails.billing_city}
                      onChange={handleBillingDetailsChange}
                      placeholder="City"
                      required
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      name="billing_state"
                      value={billingDetails.billing_state}
                      onChange={handleBillingDetailsChange}
                      placeholder="State"
                      required
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      State Code *
                    </label>
                    <input
                      type="text"
                      name="state_code"
                      value={billingDetails.state_code}
                      onChange={handleBillingDetailsChange}
                      placeholder="19"
                      maxLength={2}
                      required
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">2-digit state code (e.g., 19 for West Bengal)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pincode * 
                      {pincodeLoading && (
                        <span className="ml-2 text-xs text-blue-500 flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          Auto-filling...
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="billing_pincode"
                      value={billingDetails.billing_pincode}
                      onChange={handleBillingDetailsChange}
                      placeholder="123456"
                      maxLength={6}
                      required
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter 6-digit pincode to auto-fill city & state</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      name="billing_country"
                      value={billingDetails.billing_country}
                      onChange={handleBillingDetailsChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-3">Bank Details (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      name="bank_name"
                      value={billingDetails.bank_name}
                      onChange={handleBillingDetailsChange}
                      placeholder="Bank name"
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      name="bank_account_number"
                      value={billingDetails.bank_account_number}
                      onChange={handleBillingDetailsChange}
                      placeholder="Account number"
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      name="ifsc_code"
                      value={billingDetails.ifsc_code}
                      onChange={handleBillingDetailsChange}
                      placeholder="SBIN0001234"
                      maxLength={11}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">11-character IFSC code (e.g., SBIN0001234)</p>
                  </div>
                </div>
              </div>

              {/* Invoice Settings */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-3">Invoice Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Invoice Prefix
                    </label>
                    <input
                      type="text"
                      name="invoice_prefix"
                      value={billingDetails.invoice_prefix}
                      onChange={handleBillingDetailsChange}
                      placeholder="INV-"
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">Prefix for invoice numbers (e.g., INV-, BILL-, etc.)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Logo URL (Optional) - Supported formats: PNG, JPG, and WebP
                    </label>
                    <input
                      type="url"
                      name="invoice_logo_url"
                      value={billingDetails.invoice_logo_url}
                      onChange={handleBillingDetailsChange}
                      placeholder="https://example.com/logo.png"
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">URL to your company logo for invoices (PNG, JPG, or WebP format)</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={billingLoading}
                  className="px-6 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {billingLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save Billing Details
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User Management (Admin only) */}
        {userRole === 'admin' && (
          <div className="bg-light-pink-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md col-span-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">User Management</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">Manage employees, delivery staff, and shipment staff.</p>
            
            <div className="mb-4">
              <button 
                onClick={() => setShowAddUser(true)}
                className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 mr-2"
              >
                Add User
              </button>
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <div className="mb-6 p-4 border border-gray-300 dark:border-gray-600 rounded-md">
                <h3 className="text-lg font-semibold mb-3">Add New User</h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, '');
                        setNewUser({...newUser, phone: numericValue});
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="Enter phone number"
                      className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="">Select a role</option>
                      <option value="Employee">Employee</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Shipment">Shipment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      placeholder="Set password for this user"
                      className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 mr-2"
                    >
                      {loading ? 'Adding...' : 'Add User'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowAddUser(false)}
                      className="px-4 py-2 rounded-md bg-gray-500 text-white hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Users List */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-light-pink-100 dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user: any) => (
                    <tr key={user.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                          user.role === 'Employee' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          user.role === 'Delivery' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          user.role === 'Shipment' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {user.role || 'Employee'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleRemoveUser(user.user_id.toString())}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}