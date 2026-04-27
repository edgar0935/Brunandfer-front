import React, { useEffect, useState } from "react";
import { FaArchive, FaTruck, FaHistory } from "react-icons/fa";
import { getRecentMovements, movementLabel, type Movement } from "@/services/activity";
import { listInventory } from "@/services/inventory";
import { listVehicles } from "@/services/vehicles";
import "./Dashboard.css";

export default function Dashboard() {
  const [itemsCount, setItemsCount] = useState(0);
  const [vehCount, setVehCount] = useState(0);
  const [rows, setRows] = useState<Movement[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [inv, veh] = await Promise.all([listInventory(), listVehicles()]);
      if (!alive) return;
      setItemsCount(inv.length);
      setVehCount(veh.length);
      setRows(await getRecentMovements(6));
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page dashboard">
      {/* Saludo arriba */}
      <div className="hero-card saludo">
        <h2 className="hero-title">¡Bienvenido de vuelta!</h2>
        <p className="hero-sub">Resumen del día: inventario y obras.</p>
      </div>

      {/* KPIs en la misma línea */}
      <div className="dash-hero">
        <div className="kpi">
          <div className="kpi__icon">
            <FaArchive />
          </div>
          <div className="kpi__num">{itemsCount.toLocaleString()}</div>
          <div className="kpi__label">Materiales registrados</div>
        </div>

        <div className="kpi">
          <div className="kpi__icon">
            <FaTruck />
          </div>
          <div className="kpi__num">{vehCount.toLocaleString()}</div>
          <div className="kpi__label">Vehículos registrados</div>
        </div>
      </div>

      {/* Últimos movimientos debajo */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">
            <FaHistory style={{ marginRight: 8 }} />
            Últimos movimientos
          </h3>
        </div>

        <ul className="activity-list">
          {rows.map((m) => {
            const label = movementLabel(m.type);
            const time = new Date(m.timestamp).toLocaleString();
            return (
              <li key={m.id} className="activity-item">
                <span className={`chip chip--${label.tone}`}>{label.text}</span>
                <div className="activity-main">
                  <div className="activity-title">{m.description}</div>
                  <div className="activity-meta">
                    {m.entity} — {m.entityId ? `#${m.entityId}` : "—"} • {time}
                  </div>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="activity-empty">Aún no hay movimientos registrados.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
