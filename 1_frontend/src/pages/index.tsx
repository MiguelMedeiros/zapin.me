/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";

import { Inter } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import axios from "axios";
import { requestProvider } from "webln";

import ConfettiExplosion from "@/components/Confetti";
import PopUpModal from "@/components/PopupModal";
import Stage0 from "@/components/Stage0";
import Stage1 from "@/components/Stage1";
import { MapComponent } from "@/components/MapComponent";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { sendEvent } from "@/Utils/analytics";

const inter = Inter({ subsets: ["latin"] });

const NEXT_PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const NEXT_PUBLIC_LIMIT_MESSAGES = process.env.NEXT_PUBLIC_LIMIT_MESSAGES;

export default function Home() {
  const searchParams = useSearchParams();
  const searchPin = searchParams.get("pin");

  const [socketId, setSocketId] = useState<string | null>(null);
  const [marketList, setMarkerList] = useState<any[]>([]);
  const [markerListDeactivated, setMarkerListDeactivated] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState(0);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [runConfetti, setRunConfetti] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(1440);
  const [usersConnected, setUsersConnected] = useState(0);
  const [totalPins, setTotalPins] = useState(0);
  const [center, setCenter] = useState({ lat: 20, lng: 0 });
  const [marker, setMarker] = useState({ lat: 0, lng: 0 });
  const [totalPinsActive, setTotalPinsActive] = useState(0);
  const [activeMarkerId, setActiveMarkerId] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingActive, setLoadingActive] = useState<boolean>(true);
  const [loadingInactive, setLoadingInactive] = useState<boolean>(true);

  const fetchTotalPins = async () => {
    const response = await axios.get(
      `${NEXT_PUBLIC_BACKEND_URL}/invoices/count`
    );

    setTotalPins(response.data.totalActive + response.data.totalExpired);
    setTotalPinsActive(response.data.totalActive);
  };

  const fetchInvoices = async (page: number) => {
    setLoadingActive(true);
    try {
      const response = await axios.get(`${NEXT_PUBLIC_BACKEND_URL}/invoices`, {
        params: {
          page: page,
          limit: NEXT_PUBLIC_LIMIT_MESSAGES,
        },
      });

      setMarkerList((prevInvoices) => [
        ...prevInvoices,
        ...response.data.invoices,
      ]);
    } catch (error) {
      console.error("Erro ao buscar marcadores ativos:", error);
    } finally {
      setLoadingActive(false);
    }
  };

  const fetchInvoicesDeactivated = async (page: number) => {
    setLoadingInactive(true);
    try {
      const response = await axios.get(
        `${NEXT_PUBLIC_BACKEND_URL}/invoices/deactivated`,
        {
          params: {
            page: page,
            limit: NEXT_PUBLIC_LIMIT_MESSAGES,
          },
        }
      );

      setMarkerListDeactivated((prevInvoices) => [
        ...prevInvoices,
        ...response.data.invoices,
      ]);
    } catch (error) {
      console.error("Erro ao buscar marcadores inativos:", error);
    } finally {
      setLoadingInactive(false);
    }
  };

  const cleanForm = () => {
    setMessage("");
    setAmount(1440);
  };

  const initWebLN = async () => {
    try {
      if (!invoice) return;

      const webln = await requestProvider();

      webln.enable();
      webln.sendPayment(invoice);
    } catch (err) {
      console.log(err);
    }
  };

  const onRightClick = (lat: number, long: number) => {
    setCenter({ lat: lat, lng: long });
    setMarker({ lat: lat, lng: long });
    setShowModal(true);
  };

  useEffect(() => {
    if (searchPin) {
      setActiveMarkerId(parseInt(searchPin));
    }
  }, [searchPin]);

  useEffect(() => {
    if (!socketId) return;

    fetchInvoices(page);
    fetchInvoicesDeactivated(page);
    fetchTotalPins();
  }, [socketId, page]);

  useEffect(() => {
    setTimeout(() => {
      fetchTotalPins();
    }, 1000);
  }, [marketList]);

  useEffect(() => {
    const socket = io(`${NEXT_PUBLIC_BACKEND_URL}`);

    socket.on("connect", () => {
      if (socket.id) {
        setSocketId(socket.id);
      }
    });

    socket.on("paid", () => {
      sendEvent({
        action: "purchase",
        category: "Ecommerce",
        label: "Invoice Paid",
        value: amount,
      });
      setInvoice(null);
      setStage(0);
      setShowModal(false);
      cleanForm();
    });

    socket.on("users-connected", (message) => {
      setUsersConnected(message);
    });

    socket.on("new-message", (message) => {
      const messageParsed = JSON.parse(message);

      setMarkerList((prevInvoices) => [messageParsed, ...prevInvoices]);
      setRunConfetti(true);
      fetchTotalPins();

      setTimeout(() => {
        setRunConfetti(false);
      }, 5000);
    });

    return () => {
      socket.off("connect");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!invoice) return;

    initWebLN();
  }, [invoice]);

  useEffect(() => {
    if (showModal) {
      sendEvent({
        action: "open_modal",
        category: "Engagement",
        label: "Create Marker Modal Opened",
      });
    }
  }, [showModal]);

  return (
    <main
      className={`flex flex-col bg-gray-900 text-white ${inter.className} h-screen`}
    >
      <Header
        version="0.2.0"
        setShowModal={setShowModal}
        usersConnected={usersConnected}
        totalPins={totalPins}
        activePins={totalPinsActive}
        setSidebarOpen={setSidebarOpen}
      />
      <div className="flex flex-1">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeMessages={marketList}
          inactiveMessages={markerListDeactivated}
          loadingActive={loadingActive}
          loadingInactive={loadingInactive}
          setActiveMarkerId={setActiveMarkerId}
          activeMarkerId={activeMarkerId}
        />

        <div className="flex-1">
          <MapComponent
            onRightClick={onRightClick}
            markers={marketList}
            markerListDeactivated={markerListDeactivated}
            setMarkerListDeactivated={setMarkerListDeactivated}
            fetchTotalPins={fetchTotalPins}
            setMarkers={setMarkerList}
            activeMarkerId={activeMarkerId}
            center={center}
            setActiveMarkerId={setActiveMarkerId}
          />
        </div>
      </div>
      {runConfetti && <ConfettiExplosion />}
      <PopUpModal
        showModal={showModal}
        setShowModal={setShowModal}
        setInvoice={setInvoice}
        setStage={setStage}
      >
        {stage === 0 && (
          <Stage0
            setShowModal={setShowModal}
            socketId={socketId}
            setInvoice={setInvoice}
            setStage={setStage}
            message={message}
            center={center}
            marker={marker}
            setCenter={setCenter}
            setMarker={setMarker}
            setMessage={setMessage}
            setAmount={setAmount}
            amount={amount}
          />
        )}
        {stage === 1 && (
          <Stage1
            invoice={invoice}
            setInvoice={setInvoice}
            setStage={setStage}
          />
        )}
      </PopUpModal>
    </main>
  );
}
