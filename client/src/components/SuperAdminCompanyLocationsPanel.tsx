import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import RestaurantMap from "@/components/RestaurantMap";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";

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
  companyId: number;
  companyName: string;
  locationCount: number;
};

export default function SuperAdminCompanyLocationsPanel({
  companyId,
  companyName,
  locationCount,
}: Props) {
  const locationsQuery = trpc.publicApi.superAdminListCompanyLocations.useQuery({
    ...emptyCreds,
    companyId,
  });
  const createLocation = trpc.publicApi.superAdminCreateCompanyLocation.useMutation();
  const updateLocation = trpc.publicApi.superAdminUpdateCompanyLocation.useMutation();
  const deleteLocation = trpc.publicApi.superAdminDeleteCompanyLocation.useMutation();

  const [activeId, setActiveId] = useState<number | undefined>();
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

  const saveActive = async () => {
    if (!activeLocation) return;
    try {
      await updateLocation.mutateAsync({
        ...emptyCreds,
        companyId,
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
    if (!name.trim()) {
      toast.error("Indica un nombre para la sede");
      return;
    }
    try {
      await createLocation.mutateAsync({
        ...emptyCreds,
        companyId,
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
        ...emptyCreds,
        companyId,
        locationId,
      });
      toast.success("Sede eliminada");
      if (activeId === locationId) setActiveId(undefined);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <MapPin className="size-4" />
            Sedes / locales — {companyName}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {locationCount} sede{locationCount === 1 ? "" : "s"} registrada(s). Gestión multi-sede solo
            desde superadmin.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4 mr-1" />
          Nueva sede
        </Button>
      </div>

      {locations.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <Button
              key={loc.id}
              type="button"
              size="sm"
              variant={loc.id === activeLocation?.id ? "default" : "outline"}
              onClick={() => setActiveId(loc.id)}
            >
              {loc.name}
              {loc.isPrimary ? " (principal)" : ""}
            </Button>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <p className="text-sm font-medium">Nueva sede</p>
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <Button type="button" size="sm" onClick={() => void addLocation()} disabled={createLocation.isPending}>
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
                min={0}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                0 = sin validación GPS. Recomendado 50–150 m si hay geovalla.
              </p>
            </div>
          </div>

          <RestaurantMap
            latitude={latitude}
            longitude={longitude}
            initialAddress={address}
            onLocationSelect={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
            onAddressChange={(next) => setAddress(next)}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void saveActive()} disabled={updateLocation.isPending}>
              Guardar sede
            </Button>
            {locations.length > 1 && !activeLocation.isPrimary ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
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
        <p className="text-sm text-muted-foreground">
          Esta empresa aún no tiene sede. El admin la configurará en Ajustes o créala aquí.
        </p>
      )}
    </div>
  );
}
