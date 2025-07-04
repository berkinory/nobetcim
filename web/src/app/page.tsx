'use client';

import { useState, useRef, useCallback, useMemo } from 'react';

import StructuredData from '@/components/seo/StructuredData';
import { seoConfig } from '@/components/seo/seo.config';
import LocationPermissionDialog from '@/components/LocationPermissionDialog';
import MapComponent, {
    type MapHandle,
    getCurrentLocation,
    isLocationInTurkey,
} from '@/components/Map';
import MapControls from '@/components/MapControls';
import { usePharmacyQuery } from '@/lib/query/api-queries';
import { toast } from 'sonner';

export default function Home() {
    const [showLocationDialog, setShowLocationDialog] = useState(true);
    const [mapStyle, setMapStyle] = useState('custom');
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [hasGpsConfirmed, setHasGpsConfirmed] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [isRetry, setIsRetry] = useState(false);
    
    const locationRequestInProgress = useRef(false);

    const mapRef = useRef<MapHandle>(null);

    const { data: pharmacies, error } = usePharmacyQuery(hasGpsConfirmed);

    const handleLocationFound = useCallback(
        (location: { latitude: number; longitude: number }) => {
            setUserLocation(location);
            if (!hasGpsConfirmed) {
                setHasGpsConfirmed(true);
            }
        },
        [hasGpsConfirmed]
    );

    const handleLocationRequest = useCallback(async () => {
        if (locationRequestInProgress.current || isLoadingLocation) {
            return;
        }

        locationRequestInProgress.current = true;
        setShowLocationDialog(false);
        setIsLoadingLocation(true);

        try {
            const location = await getCurrentLocation();

            if (!isLocationInTurkey(location.latitude, location.longitude)) {
                toast.error('Bu uygulama sadece Türkiye içinde kullanılabilir');
                setShowLocationDialog(true);
                setIsRetry(true);
                return;
            }

            handleLocationFound(location);
            setIsRetry(false);
        } catch (error) {
            console.error('Failed to get location:', error);
            let errorMessage = 'Konum alınamadı. Lütfen tekrar deneyin';
            
            if (error instanceof GeolocationPositionError) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini etkinleştirin';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Konum servislerine erişilemiyor. Lütfen konum servislerinizin açık olduğundan emin olun';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Konum alınamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin';
                        break;
                    default:
                        errorMessage = 'Konum alınamadı. Lütfen konum servislerinizin açık olduğundan emin olun ve tekrar deneyin';
                }
            }
            
            toast.error(errorMessage);
            setShowLocationDialog(true);
            setIsRetry(true);
        } finally {
            setIsLoadingLocation(false);
            locationRequestInProgress.current = false;
        }
    }, [handleLocationFound, isLoadingLocation]);

    const handleStyleChange = useCallback((newStyle: string) => {
        setMapStyle(newStyle);
    }, []);

    const handleZoomIn = useCallback(() => {
        mapRef.current?.zoomIn();
    }, []);

    const handleZoomOut = useCallback(() => {
        mapRef.current?.zoomOut();
    }, []);

    const handleLocationFocus = useCallback(() => {
        mapRef.current?.flyToUserLocation();
    }, []);

    const structuredData = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: seoConfig.site.name,
            url: seoConfig.site.url || 'http://localhost:3000',
            inLanguage: 'tr',
        }),
        []
    );

    if (error) {
        toast.error('Eczane bilgileri yüklenirken hata oluştu');
    }

    return (
        <>
            <StructuredData data={structuredData} />
            <LocationPermissionDialog
                open={showLocationDialog}
                onLocationRequest={handleLocationRequest}
                onOpenChange={setShowLocationDialog}
                isRetry={isRetry}
            />
            <main className="h-full flex flex-col">
                <div className="w-full h-full relative">
                    {isLoadingLocation && (
                        <div className="absolute inset-0 bg-background flex items-center justify-center z-50">
                            <div className="text-center">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                    Konumunuz alınıyor...
                                </p>
                            </div>
                        </div>
                    )}

                    {userLocation && !isLoadingLocation && (
                        <>
                            <MapComponent
                                ref={mapRef}
                                mapStyle={mapStyle}
                                pharmacies={pharmacies}
                                onLocationFound={handleLocationFound}
                                initialLocation={userLocation}
                            />

                            <MapControls
                                mapStyle={mapStyle}
                                hasUserLocation={!!userLocation}
                                onStyleChange={handleStyleChange}
                                onZoomIn={handleZoomIn}
                                onZoomOut={handleZoomOut}
                                onLocationFocus={handleLocationFocus}
                            />
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
