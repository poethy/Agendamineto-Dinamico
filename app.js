const procedimientos = [
    { id: 1, nombre: 'Cejas', duracion: 30 },
    { id: 2, nombre: 'Henna', duracion: 45 },
    { id: 3, nombre: 'Pestañas', duracion: 60 }
];

// Estado global
const estado = {
    procedimientoSeleccionado: null,
    fechaSeleccionada: null,
    horaSeleccionada: null,
    citas: [],
    horariosBloqueados: new Set()
};

// Horario de trabajo
const HORARIO_INICIO = 9 * 60; // 9:00AM
const HORARIO_FIN = 20 * 60;   // 8:00PM
const HORA_LIMITE_AGENDAMIENTO = 21 * 60; // 9:00PM

// Función para actualizar la hora actual de Colombia
function actualizarHoraColombia() {
    const ahora = new Date();
    const horaColombia = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const horaFormateada = horaColombia.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
    });
    document.getElementById('hora-actual').textContent = horaFormateada;
}

// Actualizar la hora cada segundo
setInterval(actualizarHoraColombia, 1000);
actualizarHoraColombia(); // Actualizar inmediatamente al cargar

document.addEventListener('DOMContentLoaded', () => {
    cargarProcedimientos();
    inicializarCalendario();
    cargarCitasGuardadas();
});

function cargarProcedimientos() {
    const contenedor = document.getElementById('procedimientos-lista');
    procedimientos.forEach(proc => {
        const elemento = document.createElement('div');
        elemento.className = 'procedimiento-item';
        elemento.innerHTML = `
            <h6>${proc.nombre}</h6>
            <small>Duración: ${proc.duracion} minutos</small>
        `;
        elemento.addEventListener('click', () => seleccionarProcedimiento(proc));
        contenedor.appendChild(elemento);
    });
}

function seleccionarProcedimiento(procedimiento) {
    estado.procedimientoSeleccionado = procedimiento;
    document.querySelectorAll('.procedimiento-item').forEach(el => {
        el.classList.remove('seleccionado');
    });
    event.currentTarget.classList.add('seleccionado');
    actualizarCalendario();
}

function inicializarCalendario() {
    const contenedor = document.getElementById('calendario');
    const hoy = new Date();
    
    // Mostrar próximos 7 días
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        
        const diaElemento = document.createElement('div');
        diaElemento.className = 'dia-calendario';
        if (i === 0) diaElemento.classList.add('hoy');
        
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        diaElemento.innerHTML = `
            <h6>${fechaFormateada}</h6>
            <div class="horas-disponibles" data-fecha="${fecha.toISOString()}"></div>
        `;
        
        contenedor.appendChild(diaElemento);
        actualizarHorasDisponibles(fecha);
    }
}

function actualizarHorasDisponibles(fecha) {
    const contenedor = document.querySelector(`[data-fecha="${fecha.toISOString()}"]`);
    contenedor.innerHTML = '';
    
    const esManana = fecha.getDate() === new Date().getDate() + 1;
    const esHoy = fecha.getDate() === new Date().getDate() && 
                  fecha.getMonth() === new Date().getMonth() && 
                  fecha.getFullYear() === new Date().getFullYear();
    const horaActual = new Date();
    const horaActualMinutos = horaActual.getHours() * 60 + horaActual.getMinutes();
    
    // Si es el día actual y ya pasó la hora límite, mostrar mensaje
    if (esHoy && horaActualMinutos >= HORARIO_FIN) {
        contenedor.innerHTML = '<p class="text-danger">No se pueden agendar citas para hoy</p>';
        return;
    }
    
    // Verificar si se puede agendar para mañana
    if (esManana && horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO) {
        // Mostrar mensaje solo para horarios antes de las 12:00
        if (horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO) {
            contenedor.innerHTML = '<p class="text-danger">Horarios de la mañana no disponibles</p>';
        }
    }
    
    // Generar slots de tiempo
    for (let hora = HORARIO_INICIO; hora < HORARIO_FIN; hora += 30) {
        const horaFormateada = `${Math.floor(hora/60).toString().padStart(2, '0')}:${(hora%60).toString().padStart(2, '0')}`;
        const slotElemento = document.createElement('span');
        
        if (esSlotDisponible(fecha, hora)) {
            slotElemento.className = 'hora-disponible';
            slotElemento.textContent = horaFormateada;
            slotElemento.addEventListener('click', () => seleccionarHora(fecha, hora));
        } else {
            slotElemento.className = 'hora-no-disponible';
            slotElemento.textContent = horaFormateada;
        }
        
        contenedor.appendChild(slotElemento);
    }
}

function esSlotDisponible(fecha, hora) {
    const fechaHora = new Date(fecha);
    fechaHora.setHours(Math.floor(hora/60), hora%60);
    
    const horaActual = new Date();
    const horaActualMinutos = horaActual.getHours() * 60 + horaActual.getMinutes();
    
    // Si es el día actual y la hora ya pasó, no permitir agendar
    if (fecha.getDate() === horaActual.getDate() && 
        fecha.getMonth() === horaActual.getMonth() && 
        fecha.getFullYear() === horaActual.getFullYear() && 
        hora <= horaActualMinutos) {
        return false;
    }
    
    // Si es mañana y la hora actual es después de las 21:00, bloquear solo horarios de la mañana
    if (fecha.getDate() === new Date().getDate() + 1 && 
        horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO && 
        hora < 12 * 60) { // Antes de las 12:00
        return false;
    }
    
    // Verificar si hay suficiente tiempo para la duración de la cita
    const duracion = estado.procedimientoSeleccionado ? estado.procedimientoSeleccionado.duracion : 30;
    if (hora + duracion > HORARIO_FIN) {
        return false;
    }
    
    // Verificar si está bloqueado
    if (estado.horariosBloqueados.has(fechaHora.toISOString())) {
        return false;
    }
    
    // Verificar si hay citas que se sobre ponen
    return !estado.citas.some(cita => {
        const citaInicio = new Date(cita.fecha);
        const citaFin = new Date(citaInicio);
        citaFin.setMinutes(citaInicio.getMinutes() + cita.duracion);
        
        return fechaHora >= citaInicio && fechaHora < citaFin;
    });
}

function seleccionarHora(fecha, hora) {
    if (!estado.procedimientoSeleccionado) {
        alert('Por favor, seleccione un procedimiento primero');
        return;
    }
    
    estado.fechaSeleccionada = new Date(fecha);
    estado.fechaSeleccionada.setHours(Math.floor(hora/60), hora%60);
    
    const fechaFormateada = estado.fechaSeleccionada.toLocaleString('es-ES');
    document.getElementById('fecha-seleccionada').textContent = fechaFormateada;
    document.getElementById('procedimiento-seleccionado').textContent = estado.procedimientoSeleccionado.nombre;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmacionModal'));
    modal.show();
}

// Confirmar cita
function confirmarCita() {
    if (!estado.procedimientoSeleccionado || !estado.fechaSeleccionada) {
        alert('Por favor, seleccione un procedimiento y una fecha');
        return;
    }
    
    const cita = {
        fecha: estado.fechaSeleccionada.toISOString(),
        procedimiento: estado.procedimientoSeleccionado.nombre,
        duracion: estado.procedimientoSeleccionado.duracion
    };
    
    // Bloquear todos los slots necesarios para la duración de la cita
    const fechaInicio = new Date(cita.fecha);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMinutes(fechaInicio.getMinutes() + cita.duracion);
    
    // Agregar la cita al estado
    estado.citas.push(cita);
    
    // Guardar en localStorage
    localStorage.setItem('citas', JSON.stringify(estado.citas));
    
    // Cerrar el modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmacionModal'));
    modal.hide();
    
    // Actualizar la vista
    actualizarCalendario();
    
    // Limpiar selección
    estado.procedimientoSeleccionado = null;
    estado.fechaSeleccionada = null;
    
    // Mostrar mensaje de éxito
    alert('Cita agendada con éxito');
}

function cargarCitasGuardadas() {
    const citasGuardadas = localStorage.getItem('citas');
    if (citasGuardadas) {
        estado.citas = JSON.parse(citasGuardadas);
    }
}

function actualizarCalendario() {
    const contenedor = document.getElementById('calendario');
    contenedor.innerHTML = '';
    inicializarCalendario();
    
    // Restaurar la selección del procedimiento si existe
    if (estado.procedimientoSeleccionado) {
        const procedimientos = document.querySelectorAll('.procedimiento-item');
        procedimientos.forEach(proc => {
            if (proc.querySelector('h6').textContent === estado.procedimientoSeleccionado.nombre) {
                proc.classList.add('seleccionado');
            }
        });
    }
}

// Función de testing para borrar todas las citas
document.getElementById('borrar-citas').addEventListener('click', () => {
    if (confirm('¿Está seguro de que desea borrar todas las citas?')) {
        localStorage.removeItem('citas');
        estado.citas = [];
        actualizarCalendario();
        alert('Todas las citas han sido borradas');
    }
});

// Event Listeners
document.getElementById('confirmar-cita').addEventListener('click', confirmarCita); 