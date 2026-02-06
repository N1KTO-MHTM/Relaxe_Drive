import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
if (typeof window !== 'undefined') (window as unknown as { L: typeof L }).L = L;
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat';
export default L;
