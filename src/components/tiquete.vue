<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import Cookies from 'js-cookie'
import { PDFDocument, rgb } from 'pdf-lib';
import { useClienteStore } from "../stores/clientes.js";
import { useRutasStore } from '../stores/rutas.js';
import { useVendedorStore } from '../stores/vendedor.js';
import { useTiqueteStore } from '../stores/tiquete';
import { useBusStore } from '../stores/buses';

const router = useRouter();
const useTiquete = useTiqueteStore();
const useCliente = useClienteStore();
const useRutas = useRutasStore();
const useBus = useBusStore();
const useVendedor = useVendedorStore();
const $q = useQuasar();
const conVenta = ref('ruta');
const conVentaBus = ref('bus')
const loadingruta = ref(true);
const selectLoad = ref(true);

const modalclientes = ref(false);
const loadingmodalclientes = ref(false);
const estado = ref("guardar");

const data = ref({ num_asiento: 0, valor: '' });

function fechaActual() {
    const fecha = new Date
    const formatoFecha = `${fecha.getFullYear()}/${(fecha.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${fecha.getDate().toString().padStart(2, '0')}`;

    return formatoFecha
}

const date = ref(fechaActual())
const options = ref({ ruta: [] })
const models = ref({})

const obtenerOptions = async () => {
    try {
        loadingruta.value = true
        const rutas = await useTiquete.continuarVentas()
        console.log(rutas);
        const responseRutas = await useRutas.obtener();
        const responseCliente = await useCliente.obtener()
        const responseBus = await useBus.obtener()
        console.log(responseCliente);
        console.log(responseBus);

        if (!rutas || !responseRutas || !responseCliente || !responseBus) return

        if (rutas.error) {
            notificar('negative', rutas.error)
            return
        }
        if (responseRutas.error) {
            notificar('negative', responseRutas.error)
            return
        }
        if (responseCliente.error) {
            notificar('negative', responseCliente.error)
            return
        }
        if (responseBus.error) {
            notificar('negative', responseCliente.error)
            return
        }

        const rutasVentas = rutas.map(c => { return { label: c.ruta.ciudad_origen.nombre + "/" + c.ruta.ciudad_destino.nombre + "/" + convertirHora(c.ruta.hora_salida), value: c.ruta._id, fecha_salida: c.fecha_salida } })

        const conjuntoLabels = new Set();
        const datosFiltrados = rutasVentas.filter((item) => {
            if (conjuntoLabels.has(item.label)) {
                return false;
            }

            conjuntoLabels.add(item.label);
            return true;
        });
        console.log(datosFiltrados);

        options.value.rutasVentas = datosFiltrados
        models.value.rutasVentas = rutas;

        options.value.ruta = responseRutas.map((c) => {
            return { label: c.ciudad_origen.nombre + "/" + c.ciudad_destino.nombre + "/" + convertirHora(c.hora_salida) + `${c.estado === 0 ? ' - inactiva' : ''}`, value: c._id, estado: c.estado, disable: c.estado === 0 }
        });
        models.value.ruta = responseRutas;

        options.value.cliente = responseCliente.cliente.map(c => { return { label: c.cedula + `${c.estado === 0 ? ' - inactivo' : ''}`, value: c._id, disable: c.estado === 0, estado: c.estado } })
        models.value.cliente = responseCliente.cliente

        options.value.bus = responseBus.busPopulate.map(b => { return { label: b.placa + `${b.estado === 0 ? ' - inactivo' : ''}`, value: b._id, estado: b.estado, disable: b.estado === 0 } })
        models.value.bus = responseBus.busPopulate

    } catch (error) {

    } finally {
        selectLoad.value = false
        loadingruta.value = false
    }
};
obtenerOptions()

const opcionesFiltro = ref({})
function filterFnRuta(val, update) {
    val = val.trim()
    if (val === '') {
        update(() => {
            opcionesFiltro.value.ruta = options.value[conVenta.value]
        })
        return
    }

    update(() => {
        const needle = val.toLowerCase()
        opcionesFiltro.value.ruta = options.value[conVenta.value].filter(v => v.label.toLowerCase().indexOf(needle) > -1) || []
    })
}
function filterFnBus(val, update) {
    val = val.trim()

    if (val === '') {
        update(() => {
            opcionesFiltro.value.bus = options.value[conVentaBus.value]
        })
        return
    }

    update(() => {
        const needle = val.toLowerCase()
        opcionesFiltro.value.bus = options.value[conVentaBus.value].filter(v => v.label.toLowerCase().indexOf(needle) > -1) || []
    })
}



function filterFnCliente(val, update) {
    val = val.trim()

    console.log(options.value.cliente);
    if (val === '') {
        onResetCliente()
        update(() => opcionesFiltro.value.cliente = options.value.cliente)
        return
    }

    update(() => {
        const needle = val.toLowerCase()
        opcionesFiltro.value.cliente = options.value.cliente.filter(v => v.label.toLowerCase().indexOf(needle) > -1) || []
    })
}

const cantAsientos = ref(0)

async function cargarAsientos(id) {
    await verificarAsiento()
    console.log(models.value);

    const buscar = models.value.bus.find(r => r._id === id)
    // console.log("a", asientosOcupados.value.length, "b", buscar.bus.asiento);
    if (asientosOcupados.value.length == buscar.asiento) {
        notificar('negative', 'Ya no hay asientos disponibles')
        return false
    }
    cantAsientos.value = buscar.asiento
    if (buscar) return buscar.asiento

    return id
}

/* function idCliente(cedula) {
    const buscar = models.value.cliente.find((c) => c.cedula === cedula);
    if (buscar) return buscar._id;

    return cedula;
} */

function convertirHora(cadenaFecha) {
    const fecha = new Date(cadenaFecha);
    const horas = fecha.getUTCHours().toString().padStart(2, "0");
    const minutos = fecha.getUTCMinutes().toString().padStart(2, "0");

    const horaFormateada = `${horas}:${minutos}`;
    return horaFormateada;
}

const modal = ref(false)
const opciones = ref(true)
const loadRuta = ref(false)

const informacion = ref({})

async function onSubmit() {
    loadRuta.value = true
    try {
        if (date.value.trim() === "") {
            notificar('negative', "Por favor complete todos los campos")
            return
        }

        if (data.value.ruta.estado === 0) {
            notificar('negative', 'La ruta esta inactiva')
            return
        }
        if (data.value.bus.estado === 0) {
            notificar('negative', 'La ruta esta inactiva')
            return
        }

        data.value.fecha_salida = convertirFechaBD(date.value)

        const arrData = Object.entries(data.value)
        console.log(arrData);
        for (const d of arrData) {
            if (d[0] === null) {
                notificar('negative', "Por favor complete todos los campos")
                return
            }

            if (typeof d[0] === "string") {
                if (d[0].trim() === "") {
                    notificar('negative', "Por favor complete todos los campos")
                    return
                }
            }
        }

        if (conVenta.value === 'rutasVentas') {
            const buscar = models.value.rutasVentas.find(e => convertirFecha(e.fecha_salida) === date.value && e.ruta._id === data.value.ruta.value)
            console.log(buscar);

            if (!buscar) {
                notificar('negative', 'No se han generado ventas en esa fecha')
                return
            }
        }


        const r = await cargarAsientos(data.value.bus.value)

        if (!r) return
        modal.value = false
        opciones.value = false
        console.log("onsubmit", data.value)
        informacion.value = { ...data.value }
        buscarBus(data.value.bus.value)
        // data.value.ruta = data.value.ruta.value

    } catch (error) {
        console.log(error);
    } finally {
        loadRuta.value = false
    }
}

function notificar(tipo, msg) {
    $q.notify({
        type: tipo,
        message: msg,
        position: "top"
    })
}
const dataCliente = ref({ cedula: "" })
function onReset() {
    data.value = { ruta: "" }
    date.value = fechaActual()
}

function onResetCliente() {
    dataCliente.value = {}
}

function convertirFechaBD(fechaA) {
    console.log(fechaA);
    const partes = fechaA.split('/');

    const fecha = new Date(
        parseInt(partes[0]),
        parseInt(partes[1]) - 1,
        parseInt(partes[2])
    );

    // (ISO 8601)
    const fechaFormateada = fecha.toISOString();

    return fechaFormateada;
}

const asientosOcupados = ref([])

async function verificarAsiento() {
    try {
        console.log(data.value);

        const info = {
            idBus: data.value.bus.value,
            idRuta: data.value.ruta.value,
            fecha_salida: data.value.fecha_salida
        }
        console.log('i', info);

        const response = await useTiquete.asientosOcupados(info)
        console.log(response);

        if (!response) return
        if (response.error) {
            notificar('negative', response.error)
            return
        }

        // response.forEach((t) => asientosOcupados.value.push(t.num_asiento))
        asientosOcupados.value = response.map(t => t.num_asiento)
        console.log(asientosOcupados.value);

        return true

    } catch (error) {
        console.log(error);
    }
}

function obtenerVendedor() {
    const token = Cookies.get("x-token")
    const vendedor = Cookies.get("vendedor")

    console.log("t", token, vendedor);

    if (token && vendedor) {
        return vendedor
    }

    notificar('negative', 'No hay token o vendedor')
    router.push('/')
    return false
}

const loadBuscarCliente = ref(false)

async function buscarCliente() {
    loadBuscarCliente.value = true
    try {
        console.log(dataCliente.value)
        if (dataCliente.value.cedula === null) {
            onResetCliente()
            return
        }

        if (typeof dataCliente.value.cedula === 'string') {
            if (dataCliente.value.cedula.trim() === "") {
                notificar('negative', 'Por favor ingrese la cedula')
                return false
            }
        }



        let response

        if (typeof dataCliente.value.cedula === 'string') {
            response = await useCliente.buscarxCC(dataCliente.value.cedula)
        } else response = await useCliente.buscarxCC(dataCliente.value.cedula.label)

        console.log(response);

        if (!response) return
        if (response.error) {
            notificar('negative', response.error)
            return
        }

        if (response.length <= 0) {
            notificar('negative', 'El cliente no esta registrado')
            return false
        }
        dataCliente.value = response[0]
        return true

    } catch (error) {
        console.log(error);
    } finally {
        loadBuscarCliente.value = false
    }
}

function validar() {
    let arrData = Object.entries(dataCliente.value)
    console.log(arrData);
    for (const d of arrData) {
        if (d[0] === null) {
            notificar('negative', "Por favor complete todos los campos")
            return false
        }

        if (typeof d[0] === "string") {
            if (d[0].trim() === "") {
                notificar('negative', "Por favor complete todos los campos")
                return false
            }
        }
    }

    return true
}

const loadingTicket = ref(false)

function idBus(bus){
    console.log(bus);
    if(typeof bus === 'object') return bus.value

    return bus
}
function idRuta(ruta){
    console.log(ruta);
    if(typeof ruta === 'object') return ruta.value

    return ruta
}

const valor = ref('')

async function validarCampos() {


    if (!validar()) return
    const arrData = Object.entries(data.value)
    console.log("d", data.value);
    console.log(arrData);
    for (const d of arrData) {
        if (d[0] === null) {
            notificar('negative', "Por favor complete todos los campos")
            return
        }

        if (typeof d[0] === "string") {
            if (d[0].trim() === "") {
                notificar('negative', "Por favor complete todos los campos")
                return
            }
        }
    }
    if (valor.value === '') {
        notificar('negative', "Por favor complete todos los campos")
        return
    }

    const resBuscar = await buscarCliente()
    console.log("r", resBuscar);
    if (!resBuscar) {
        return
    }

    console.log("h", data.value);

    const idVendedor = obtenerVendedor()
    console.log('v', idVendedor);

    if (!idVendedor) return

    console.log('1', data.value);

    data.value.cliente = dataCliente.value._id
    data.value.vendedor = idVendedor
    data.value.ruta = idRuta(data.value.ruta)
    data.value.bus = idBus(data.value.bus)
    data.value.valor = valor.value

    console.log(data.value);

    showCustom()
}

const ticket = ref({})
async function generarTicket() {
    try {
        console.log(data.value);

        const response = await useTiquete.guardar(data.value);
        console.log(response);

        if (!response) return
        if (response.error) {
            notificar('negative', response.error)
            return { error: response.error }
        }

        if (!response.data.tiquetePopulate) {
            notificar("negative", response)
            return { error: response }
        }
        const resData = response.data.tiquetePopulate
        notificar("positive", "Guardado exitosamente")
        asientosOcupados.value.push(resData.num_asiento)
        ticket.value = resData
        return 'todo bien'
    } catch (error) {
        console.log(error);
    }
}

function nuevaVenta() {
    modal.value = true
    data.value = { num_asiento: 0 }
    date.value = fechaActual()
    dataCliente.value = { cedula: "" }
    conVenta.value = 'ruta'
}

function formatear() {
    data.value = { num_asiento: 0, ruta: data.value.ruta, bus:data.value.bus, fecha_salida: ticket.value.fecha_salida, valor:'' }
    dataCliente.value = { cedula: "" }
    console.log("f", data.value);
}

function regresar() {
    obtenerOptions()
    opciones.value = true
    data.value.num_asiento = 0
}

function convertirFecha(cadenaFecha) {
    const fecha = new Date(cadenaFecha);
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
    const dia = fecha.getDate().toString().padStart(2, "0");

    const fechaFormateada = `${año}/${mes}/${dia}`;
    return fechaFormateada;
}

async function showCustom() {
    loadingTicket.value = true
    try {
        const t = await generarTicket()

        console.log(t);
        if (!t) return

        if (t.error) {
            dialog.update({
                title: 'Error!!',
                message: t.error,
                progress: false,
                ok: true
            }).onOk(() => {

            })

            return
        }

        const dialog = $q.dialog({
            title: 'Generando',
            dark: false,
            progress: true,
            persistent: true,
            ok: false
        })

        console.log(ticket.value);

        /* const mensaje = `
    <main>
        <span>------------------------------------------</span>
        <section>
            <article>
                <span>Cliente: ${ticket.value.cliente.nombre}</span> 
                <span>Cedula: ${ticket.value.cliente.cedula}</span> 
            </article>
            <article> 
                <span>Email: ${ticket.value.cliente.email}</span> 
            </article>  
        </section>
        <span>------------------------------------------</span>
        <section>
            <article>
                <span>Fecha de viaje: ${convertirFecha(ticket.value.fecha_salida)}</span>
                <span>Hora: ${convertirHora(ticket.value.ruta.hora_salida)}</span>
            </article>
            <article>
                <span>Ciudad origen: ${ticket.value.ruta.ciudad_origen.nombre}</span>
                <span>Ciudad destino: ${ticket.value.ruta.ciudad_destino.nombre}</span>
            </article>
        </section>
        <span>------------------------------------------</span>
        <section>
            <article>
                <span>Puesto: ${ticket.value.num_asiento}</span>
                <span>Bus(placa): ${ticket.value.ruta.bus.placa}</span>
            </article>    
            <article>
                <span>Empresa: ${ticket.value.ruta.bus.empresa}</span>
            </article>    
        </section>
        <span>------------------------------------------</span>
        <section>
            <span>Fecha compra: ${convertirFecha(ticket.value.createdAt)}</span> 
            <span>Vendedor: ${ticket.value.vendedor.nombre}</span>
        </section>
        <span>------------------------------------------</span>
    </main>` */

        generarPDF()

        dialog.update({
            title: 'Ticket',
            message: 'Presione ok para continuar',
            progress: false,
            html: true,
            ok: true
        }).onOk(() => {
            formatear()
        })

        formatear()
    } catch (error) {
        console.log(error);
    } finally {
        loadingTicket.value = false
    }


}


function optionsFecha(fecha) {
    if (conVenta.value === 'rutasVentas') return fecha > '0000/00/00'

    const fechaA = fechaActual()
    console.log(fechaA);
    return fecha >= fechaA
}

function continuarVenta() {
    nuevaVenta()

    conVenta.value = 'rutasVentas'
}

const loadingClienteNuevo = ref(false)

const enviarInfo = {
    guardar: async () => {
        loadingmodalclientes.value = true;
        loadingClienteNuevo.value = true
        try {
            const response = await useCliente.guardar(dataclientes.value);
            console.log(response);

            if (!response) return
            if (response.error) {
                notificar('negative', response.error)
                return
            }

            notificar('positive', 'Guardado exitosamente')
            const cedula = { label: response.cliente.cedula, value: response.cliente._id }
            options.value.cliente.push(cedula)
            models.value.cliente.push(response.cliente)
            dataCliente.value = { ...response.cliente, cedula }
            modalclientes.value = false;
        } catch (error) {
            console.log(error);
        } finally {
            loadingmodalclientes.value = false;
            loadingClienteNuevo.value = false
        }
    }
};

function validarCamposCliente() {

    const arrData = Object.entries(dataclientes.value)
    console.log(arrData);
    for (const d of arrData) {
        console.log(d);
        if (d[1] === null) {
            notificar('negative', "Por favor complete todos los campos")
            return
        }
        if (typeof d[1] === 'string') {
            if (d[1].trim() === "") {
                notificar('negative', "Por favor complete todos los campos")
                return
            }
        }

        if (d[0] === "nombre" && d[1].length > 15) {
            notificar('negative', 'El nombre no puede tener más de 15 caracteres')
            return
        }

        if (d[0] === "cedula" && d[1].toString().length < 8) {
            notificar('negative', "La cedula debe tener más de 8 digitos")
            return
        }

        if (d[0] === "email" && !d[1].includes('@')) {
            notificar('negative', 'Email no válido')
            return
        }
    }
    enviarInfo[estado.value]()
}
const dataclientes = ref({

});
const opcionesclientes = {
    agregar: () => {
        dataclientes.value = {
            nombre: "",
            cedula: '',
            email: "",
            telefono:'',
        };
        modalclientes.value = true;
        estado.value = "guardar";
    }
};

async function generarPDF() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 500]);
    const { width, height } = page.getSize();
    const size = 10

    const lineasHorizontales = [70, 120, 150, 195, 225, 270, 300, 330, 375, 405];
    lineasHorizontales.forEach((y) => {
        page.drawLine({ start: { x: 40, y: height - y }, end: { x: width - 50, y: height - y }, color: rgb(0, 0, 0) });
    });

    /* const lineasVerticales = [[190, 70, 120],[140, 120, 165], [220, 120, 165], [190, 165, 210],]
    lineasVerticales.forEach(y => {
        page.drawLine({ start: { x: y[0], y: height - y[1] }, end: { x: y[0], y: height - y[2] }, color: rgb(0, 0, 0) })
    }) */

    const dataT = [
        ["Fecha de venta:", 50, 90],
        [convertirFecha(ticket.value.createdAt), 50, 105],
        ["Vendedor:", 190, 90],
        [ticket.value.vendedor.nombre + ' '+ ticket.value.vendedor.apellido, 190, 105],
        [`Cliente: ${ticket.value.cliente.nombre}`, 50, 140],
        ["Cedula:", 50, 170],
        [ticket.value.cliente.cedula, 50, 185],
        ["Teléfono:", 190, 170],
        [ticket.value.cliente.telefono, 190, 185],
        [`Email: ${ticket.value.cliente.email}`, 50, 215],
        ["Fecha de viaje:", 50, 245],
        [convertirFecha(ticket.value.fecha_salida), 50, 260],
        ["Hora:", 190, 245],
        [convertirHora(ticket.value.ruta.hora_salida), 190, 260],
        [`Ciudad origen: ${ticket.value.ruta.ciudad_origen.nombre}`, 50, 290],
        [`Ciudad destino: ${ticket.value.ruta.ciudad_destino.nombre}`, 50, 320],
        ["Puesto:", 50, 350],
        [ticket.value.num_asiento, 50, 365],
        ["Número bus:", 110, 350],
        [ticket.value.bus.numero, 110, 365],
        [`Placa bus: ${ticket.value.bus.placa}`, 190, 350],
        [`Empresa: ${ticket.value.bus.empresa}`, 190, 365],
        [`Precio: ${formatearMoneda(ticket.value.valor)}`, 50, 395],
        ["¡Gracias por su compra!", 140, 430],
        ["¡¡Feliz viaje!!", 160, 455],
    ];
    dataT.forEach(d => {
        page.drawText(d[0], { x: d[1], y: height - d[2], size });
    })

    page.drawLine({ start: { x: 40, y: height - lineasHorizontales[0] }, end: { x: 40, y: height - lineasHorizontales[lineasHorizontales.length-1] }, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: 350, y: height - lineasHorizontales[0] }, end: { x: 350, y: height - lineasHorizontales[lineasHorizontales.length-1] }, color: rgb(0, 0, 0) });

    page.drawText('PASAJE BUS', { x: 150, y: height - 50, size: 15 });

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    const pdfUrl = URL.createObjectURL(pdfBlob);

    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
        printWindow.onload = () => {
            printWindow.print();
        };
    } else {
        notificar('negative', 'Error, no se pudo abrir la ventana de impresión')
    }
}

function buscarBus(id) {
    const buscar = models.value.bus.find(b => b._id === id)

    if (buscar) {
        informacion.value.bus = buscar
    }
}

function limitarLongitud(input, maxLength) {

    if (dataclientes.value[input] > maxLength) {
        dataclientes.value[input] = dataclientes.value[input].slice(0, maxLength);
    }
}

function formatearMoneda(numero) {
  const numeroRedondeado = Math.round(numero);
  const partes = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).formatToParts(numeroRedondeado);
  
  return partes.map(part => {
    if (part.type === 'fraction') {
      return ''; 
    } else {
      return part.value;
    }
  }).join('');
}

</script>
<template>
    <div>
        <div v-if="opciones">
            <q-btn label="Nueva venta" color="primary" @click="nuevaVenta" class="btnagregar" />
            <q-btn @click="continuarVenta" class="btnagregar">Continuar venta</q-btn>
        </div>

        <q-dialog v-model="modal">
            <q-card style="width: 600px; max-width: 95vw;">
                <q-card-section>
                    <div class="text-h6">Generar venta</div>
                </q-card-section>

                <q-card-section class="q-pt-none">
                    <q-form @submit="onSubmit" @reset="onReset" class="q-gutter-md">
                        <!-- <span>Ruta: </span> -->
                        <q-select filled v-model:model-value="data.ruta" use-input input-debounce="0" label="Ruta"
                            :loading="loadingruta" :options="opcionesFiltro.ruta" @filter="filterFnRuta" behavior="menu"
                            lazy-rules :rules="[val => val != null || 'Por favor ingrese una ruta']" :disable="loadingruta">
                            <template v-slot:no-option>
                                <q-item>
                                    <q-item-section class="text-grey">
                                        Sin resultados
                                    </q-item-section>
                                </q-item>
                            </template>
                        </q-select>
                        <q-select filled v-model:model-value="data.bus" use-input input-debounce="0" label="Bus (placa)"
                            :loading="loadingruta" :options="opcionesFiltro.bus" @filter="filterFnBus" behavior="menu"
                            lazy-rules :rules="[val => val != null || 'Por favor ingrese un bus']" :disable="loadingruta">
                            <template v-slot:no-option>
                                <q-item>
                                    <q-item-section class="text-grey">
                                        Sin resultados
                                    </q-item-section>
                                </q-item>
                            </template>
                        </q-select>

                        <!-- <span>Fecha salida: </span> -->
                        <q-input label="Fecha de salida" filled v-model="date" mask="date"
                            :rules="['date', val => val.trim() != '' || 'Ingrese una fecha']">
                            <template v-slot:append>
                                <q-icon name="event" class="cursor-pointer">
                                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                                        <q-date v-model="date" :options="optionsFecha">
                                            <div class="row items-center justify-end">
                                                <q-btn v-close-popup label="Close" color="primary" flat />
                                            </div>
                                        </q-date>
                                    </q-popup-proxy>
                                </q-icon>
                            </template>
                        </q-input>

                        <div>
                            <q-btn label="Ver asientos" type="submit" color="primary" :loading="loadRuta" />
                            <q-btn label="" type="reset" color="primary" icon="delete" class="btnDelete" />
                        </div>
                    </q-form>
                </q-card-section>
            </q-card>
        </q-dialog>


        <q-dialog v-model="modalclientes">
            <q-card class="modal">
                <q-toolbar>
                    <q-toolbar-title>Agregar </q-toolbar-title>
                    <q-btn class="botonv1" flat round dense icon="close" v-close-popup />
                </q-toolbar>

                <q-card-section class="q-gutter-md">
                    <q-form @submit="validarCamposCliente" @reset="onResetCliente" class="q-gutter-md">
                        <q-input class="input1" outlined v-model="dataclientes.nombre" label="Nombre" type="text"
                            maxlength="15" lazy-rules :rules="[val => val.trim() != '' || 'Ingrese un nombre']"></q-input>
                        <q-input class="input2" outlined v-model="dataclientes.cedula" label="Cedula" type="number"
                            :disable="estado === 'editar'" lazy-rules :oninput="limitarLongitud('cedula', 10)"
                            :rules="[val => val.trim() != '' || 'Ingrese una cedula', val => val.length < 11 || 'Cedula debe tener 10 o menos carácteres']"></q-input>

                        <q-input class="input2" outlined v-model="dataclientes.telefono" label="Teléfono" type="number"
                            lazy-rules :oninput="limitarLongitud('telefono', 10)"
                            :rules="[val => val != '' || 'Ingrese una teléfono', val => val.length == 10 || 'Número de teléfono no válido']"
                            maxlength="10"></q-input>
                        <q-input class="input3" outlined v-model="dataclientes.email" label="Email" type="email"
                            :disable="estado === 'editar'" lazy-rules
                            :rules="[val => val.trim() != '' || 'Ingrese un email']"></q-input>

                        <q-btn :loading="loadingClienteNuevo" padding="10px"
                            :color="estado == 'editar' ? 'warning' : 'secondary'" :label="estado" type="submit">
                            <q-icon :name="estado == 'editar' ? 'edit' : 'style'" color="white" right />
                        </q-btn>
                        <q-btn label="" type="reset" color="secondary" padding="10px" icon="delete" />
                    </q-form>
                </q-card-section>
            </q-card>
        </q-dialog>



        <div v-if="!opciones" class="contventa">

            <div class="contopciones">
                <div id="contRegresar">
                    <q-btn @click="regresar" class="regresar" color="accent" icon="arrow_back_ios"></q-btn>
                    <div id="info">
                        <span><b>Ruta: </b>{{ informacion.ruta.label }} </span>
                        <span><b>Placa del bus: </b>{{ informacion.bus.placa }} </span>
                        <span><b>Numero del bus: </b>{{ informacion.bus.numero }} </span>
                        <span><b>Conductor: </b>{{ informacion.bus.conductor.nombre }} </span>
                        <span><b>Fecha salida: </b>{{ convertirFecha(informacion.fecha_salida) }} </span>
                    </div>
                </div>

                <div id="contAsientos">
                    <div v-if="verificarAsiento" class="asientos" :id="data.num_asiento != 0 ? 'asientos' : ''">
                        <q-btn v-for="a in cantAsientos" icon="chair" class="asiento"
                            :class="asientosOcupados.includes(String(a)) ? 'ocupado' : 'desocupado'"
                            @click="data.num_asiento = a" :label="a" :disable="asientosOcupados.includes(String(a))" />
                    </div>

                    <div v-if="data.num_asiento != 0" class="formulario">

                        <span class="numasiento">Asiento #{{ data.num_asiento }}</span>

                        <div>
                            <!-- <q-btn label="Buscar cliente" @click="buscarCliente" color="primary" class="btnbuscar" /> -->
                            <q-btn @click="opcionesclientes.agregar" label="Nuevo cliente" class="btnagregar"
                                icon="group_add" color="primary" />
                        </div>

                        <div>
                            <q-form @submit="validarCampos" @reset="onResetCliente" class="q-gutter-md inputs">
                                <!-- <q-input outlined v-model="dataCliente.cedula" label="Cedula" type="text" maxlength="10"
                                    lazy-rules
                                    :rules="[val => val.trim() != '' || 'Por favor ingrese una cedula']"></q-input> -->
                                <q-select filled v-model:model-value="dataCliente.cedula" use-input input-debounce="0"
                                    label="Cedula" :loading="selectLoad" :options="opcionesFiltro.cliente"
                                    @filter="filterFnCliente" behavior="menu" lazy-rules
                                    :rules="[val => val != null || 'Por favor ingrese una cedula']"
                                    @update:model-value="buscarCliente">
                                    <template v-slot:no-option>
                                        <q-item>
                                            <q-item-section class="text-grey">
                                                Sin resultados
                                            </q-item-section>
                                        </q-item>
                                    </template>
                                </q-select>
                                <q-input outlined v-model="dataCliente.nombre" label="Nombre" type="text" maxlength="15"
                                    lazy-rules :rules="[val => val.trim() != '' || 'Por favor ingrese un nombre']" disable
                                    :loading="loadBuscarCliente"></q-input>
                                <q-input outlined v-model="dataCliente.email" label="Email" type="text" lazy-rules
                                    :rules="[val => val.trim() != '' || 'Por favor ingrese un email']" disable
                                    :loading="loadBuscarCliente"></q-input>
                                <q-input outlined v-model="dataCliente.telefono" label="Teléfono" type="number" lazy-rules
                                    :rules="[val => val != '' || 'Ingrese una teléfono', val => val.length == 10 || 'Número de teléfono no válido']"
                                    maxlength="10" disable :loading="loadBuscarCliente"></q-input>
                                <q-input outlined v-model="valor" label="Valor" type="number" lazy-rules
                                    :rules="[val => val != '' || 'Ingrese un valor', val=> val >0 || 'Valor no válido']"></q-input>

                                <q-btn label="Confirmar" type="submit" color="secondary" :loading="loadingTicket" />
                                <q-btn label="" type="reset" color="secondary" icon="delete" />
                            </q-form>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.btnDelete {
    margin: 10px;
}

#info{
    display: flex;
    justify-content: center;
    width:100%
}

#info>*{
    margin-right: 20px;
}

#contRegresar {
    padding-top: 20px;
    display: flex;
    align-items: center;
}

#contAsientos {
    display: flex;
    padding: 40px;
}

.asiento {
    margin: 10px;
}

.ocupado {
    background-color: #A3F7BF;
}

.desocupado {
    background-color: white;
}

.regresar {
    position: relative;
    top: 0px;
    left: 20px;
    /* margin: 20px auto; */
}

.asientos {
    display: inline-block;
    max-width: 700px;
    margin: auto;
} 

.asiento {
    padding: 20px;
}

.numasiento {
    font-weight: bold;
    font-size: 30px;
}

.inputs {
    margin: 10px;
}

.formulario {
    display: inline-block;
    margin: 20px !important;
    max-width: 500px;
    border: solid 2px;
    margin: auto;
    padding: 20px;
    height: fit-content;
}

.btnbuscar {
    margin: 10px;
}

.btnagregar {
    margin: 10px;
}

.modal {
    width: 100%;
    max-width: 600px;
}

.tabla {
    padding: 0 20px;
    margin: 10px auto;
    max-width: 1000px;
    /* min-height: 710px; */
    border: 0px solid black;
}

.titulo-cont {
    margin: auto;
}

.buscar {
    display: inline-block;
    margin: auto;
    margin-top: 8px;
    padding: 0px 15px;
    border: 1px solid rgb(212, 212, 212);
    border-radius: 5px;
}

.encabezado {
    font-weight: bold;
    font-size: 15px;
}

.botonv1 {
    font-size: 10px;
    font-weight: bold;
}

@media (max-width:1100px) {
    #contAsientos {
        margin-top: 30px;
    }
}

@media (max-width:760px) {
    #contAsientos {
        flex-direction: column;

    }

    #asientos {
        overflow-x: scroll;
        max-height: 100px;
    }
}
</style>