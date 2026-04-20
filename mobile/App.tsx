import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { YammaLogo } from '@yamma/design-system';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import type { AuthStackParamList, BuyerStackParamList, SellerStackParamList } from './src/navigation/types';
import { PaymentReturnDeepLink } from './src/navigation/PaymentReturnDeepLink';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import RestaurantScreen from './src/screens/RestaurantScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import OrderTrackingScreen from './src/screens/OrderTrackingScreen';
import SellerDashboardScreen from './src/screens/SellerDashboardScreen';
import SellerRestaurantProfileScreen from './src/screens/SellerRestaurantProfileScreen';

const buyerNavigationRef = createNavigationContainerRef<BuyerStackParamList>();

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const BuyerStack = createNativeStackNavigator<BuyerStackParamList>();
const SellerStack = createNativeStackNavigator<SellerStackParamList>();

void SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0f1014',
    card: '#0f1014',
    border: '#2c2d35',
    primary: '#ff5500',
    text: '#ffffff',
  },
};

const rootStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1014' },
  boot: { flex: 1, backgroundColor: '#0f1014', justifyContent: 'center', alignItems: 'center' },
});

const authHeaderLogo = {
  headerTitle: () => <YammaLogo width={110} height={32} />,
  headerTitleAlign: 'center' as const,
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f1014' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0f1014' },
      }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} options={authHeaderLogo} />
      <AuthStack.Screen name="Login" component={LoginScreen} options={authHeaderLogo} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={authHeaderLogo} />
    </AuthStack.Navigator>
  );
}

function BuyerNavigator() {
  return (
    <BuyerStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f1014' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0f1014' },
      }}
    >
      <BuyerStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <YammaLogo width={110} height={34} />,
        }}
      />
      <BuyerStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <BuyerStack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Orders' }} />
      <BuyerStack.Screen name="Restaurant" component={RestaurantScreen} />
      <BuyerStack.Screen name="Cart" component={CartScreen} />
      <BuyerStack.Screen name="Checkout" component={CheckoutScreen} />
      <BuyerStack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Track order' }} />
    </BuyerStack.Navigator>
  );
}

function SellerNavigator() {
  return (
    <SellerStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f1014' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#0f1014' },
      }}
    >
      <SellerStack.Screen
        name="SellerDashboard"
        component={SellerDashboardScreen}
        options={{
          headerTitle: () => <YammaLogo width={110} height={34} />,
          headerBackVisible: false,
        }}
      />
      <SellerStack.Screen
        name="SellerRestaurantProfile"
        component={SellerRestaurantProfileScreen}
        options={{ title: 'Restaurant profile' }}
      />
    </SellerStack.Navigator>
  );
}

function RootNavigator() {
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return (
      <View style={rootStyles.boot}>
        <ActivityIndicator size="large" color="#ff5500" />
      </View>
    );
  }

  if (!user) {
    return <AuthNavigator />;
  }

  if (user.role === 'restaurant') {
    return <SellerNavigator />;
  }

  return <BuyerNavigator />;
}

export default function App() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <StatusBar style="light" backgroundColor="#0f1014" />
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer ref={buyerNavigationRef} theme={navigationTheme}>
            <PaymentReturnDeepLink navigationRef={buyerNavigationRef} />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
