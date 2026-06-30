import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import RestaurantMap from "@/components/RestaurantMap";
import { trpc } from "@/lib/trpc";
import { adminApiInput, getStoredActiveLocationId, setStoredActiveLocationId } from "@/lib/adminContext";

type LocationRow = {
  id: number;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  isPrimary: boolean;
};

type Props = {
  locationLimit: number | null;
  locationCount: number;
  canAddLocation: boolean;
};

export default function AdminLocationsPanel({
  locationLimit,
  locationCount,
  canAddLocation,
}: Props) {
  const locationsQuery = trpc.publicApi.listCompanyLocations.useQuery(adminApiInput());
  const createLocation = trpc.publicApi.createCompanyLocation.useMutation();
  const updateLocation = trpc.publicApi.updateCompanyLocation.useMutation();
  const deleteLocation = trpc.publicApi.deleteCompanyLocation.useMutation();

  const [activeId, setActiveId] = useState<number | undefined>(getStoredActiveLocationId());
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(40.4168);
  const [longitude, setLongitude] = useState(-3.7038);
  const [radiusMeters, setRadiusMeters] = useState(100);

  const locations = (locationsQuery.data ?? []) as LocationRow[];
  const activeLocation = locations.find((l) => l.id === activeId) ?? locations[0];

  useEffect(() => {
    if (!activeId && locations[0]) {
      setActiveId(locations[0].id);
      setStoredActiveLocationId(locations[0].id);
    }
  }, [locations, activeId]);

  useEffect(() => {
    if (!activeLocation) return;
    setName(activeLocation.name);
    setAddress(activeLocation.address || "");
    setLatitude(Number(activeLocation.latitude));
    setLongitude(Number(activeLocation.longitude));
    setRadiusMeters(activeLocation.radiusMeters);
  }, [activeLocation?.id]);

  const refetch = async () => {
    await locationsQuery.refetch();
  };

  const selectLocation = (id: number) => {
    setActiveId(id);
    setStoredActiveLocationId(id);
    window.location.reload();
  };

  const saveActive = async () => {
    if (!activeLocation) return;
    try {
      await updateLocation.mutateAsync({
        ...adminApiInput(activeLocation.id),
        locationId: activeLocation.id,
        name,
        address,
        latitude,
        longitude,
        radiusMeters,
      });
      toast.success("Sede actualizada");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };

  const addLocation = async () => {
    try {
      await createLocation.mutateAsync({
        ...adminApiInput(),
        name,
        address,
        latitude,
        longitude,
        radiusMeters,
      });
      toast.success("Nueva sede creada");
      setShowForm(false);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la sede");
    }
  };

  const removeLocation = async (locationId: number) => {
    if (!window.confirm("¿Eliminar esta sede?")) return;
    try {
      await deleteLocation.mutateAsync({
        ...adminApiInput(),
        locationId,
      });
      toast.success("Sede eliminada");
      if (activeId === locationId) {
        setStoredActiveLocationId(null);
        setActiveId(undefined);
      }
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="size-4" />
            Sedes / locales
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {locationCount} sede{locationCount === 1 ? "" : "s"}
            {locationLimit != null ? ` · Límite plan: ${locationLimit}` : " · Multi-sede ilimitada (Enterprise)"}
          </p>
        </div>
        {canAddLocation ? (
          <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4 mr-1" />
            Nueva sede
          </Button>
        ) : null}
      </div>

      {locations.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <Button
              key={loc.id}
              type="button"
              size="sm"
              variant={loc.id === activeLocation?.id ? "default" : "outline"}
              onClick={() => selectLocation(loc.id)}
            >
              {loc.name}
              {loc.isPrimary ? " (principal)" : ""}
            </Button>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <p className="text-sm font-medium">Nueva sede</p>
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <Button type="button" onClick={() => void addLocation()} disabled={createLocation.isPending}>
            Crear sede
          </Button>
        </div>
      ) : null}

      {activeLocation ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre del local</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Radio GPS (m)</Label>
              <Input
                type="number"
                min={50}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>

          <RestaurantMap
            latitude={latitude}
            longitude={longitude}
            onLocationSelect={(lat: number, lng: number) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveActive()} disabled={updateLocation.isPending}>
              Guardar sede
            </Button>
            {locations.length > 1 && !activeLocation.isPrimary ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void removeLocation(activeLocation.id)}
                disabled={deleteLocation.isPending}
              >
                <Trash2 className="size-4 mr-1" />
                Eliminar sede
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Configura tu primer local en los ajustes del negocio.</p>
      )}
    </Card>
  );
}
